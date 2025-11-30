import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration - Sprint 2 optimizations
const CONFIG = {
  MAX_CONCURRENT_UPLOADS: 5, // Increased from 2 for better throughput
  BATCH_SIZE: 10, // Increased from 5 for faster queue processing
  DELAY_BETWEEN_UPLOADS_MS: 3000, // Reduced to 3 seconds
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY_MS: 60000, // 1 minute base delay
  SOURCE_VALIDATION_TIMEOUT_MS: 10000,
  STUCK_TIMEOUT_MINUTES: 30, // Reduced to detect stuck uploads faster
  DOWNLOADING_STUCK_MINUTES: 15, // For legacy "downloading" status
};

// Error categories for better handling
const ERROR_CATEGORIES = {
  SOURCE_UNREACHABLE: 'source_unreachable',
  CF_ENCODING_FAILED: 'cf_encoding_failed', 
  CF_FETCH_FAILED: 'cf_fetch_failed',
  RATE_LIMITED: 'rate_limited',
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
};

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][CF-Scheduler][${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

// Categorize errors for better retry decisions
function categorizeError(errorMessage: string): { category: string; shouldRetry: boolean; delayMultiplier: number } {
  const msg = (errorMessage || '').toLowerCase();
  
  if (msg.includes('unknown cause') || msg.includes('encoding failed')) {
    return { category: ERROR_CATEGORIES.CF_ENCODING_FAILED, shouldRetry: true, delayMultiplier: 2 };
  }
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
    return { category: ERROR_CATEGORIES.RATE_LIMITED, shouldRetry: true, delayMultiplier: 4 };
  }
  if (msg.includes('fetch') || msg.includes('download') || msg.includes('cannot access')) {
    return { category: ERROR_CATEGORIES.CF_FETCH_FAILED, shouldRetry: true, delayMultiplier: 2 };
  }
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('connection')) {
    return { category: ERROR_CATEGORIES.TRANSIENT, shouldRetry: true, delayMultiplier: 1 };
  }
  if (msg.includes('invalid') || msg.includes('unsupported') || msg.includes('corrupt')) {
    return { category: ERROR_CATEGORIES.PERMANENT, shouldRetry: false, delayMultiplier: 0 };
  }
  
  return { category: ERROR_CATEGORIES.TRANSIENT, shouldRetry: true, delayMultiplier: 1 };
}

// Calculate next retry time with exponential backoff
function calculateNextRetryTime(retryCount: number, delayMultiplier: number): Date {
  const baseDelay = CONFIG.BASE_RETRY_DELAY_MS;
  const exponentialDelay = baseDelay * Math.pow(2, retryCount) * delayMultiplier;
  const jitter = Math.random() * 30000; // Add up to 30 seconds jitter
  const totalDelay = Math.min(exponentialDelay + jitter, 3600000); // Cap at 1 hour
  return new Date(Date.now() + totalDelay);
}

// Validate source URL is accessible (lightweight HEAD request)
async function validateSourceUrl(url: string): Promise<{ valid: boolean; error?: string; statusCode?: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.SOURCE_VALIDATION_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok || response.status === 200 || response.status === 206) {
      return { valid: true, statusCode: response.status };
    }
    
    if (response.status === 403 || response.status === 401) {
      return { valid: false, error: 'Source requires authentication', statusCode: response.status };
    }
    
    if (response.status === 404) {
      return { valid: false, error: 'Source not found (404)', statusCode: response.status };
    }
    
    if (response.status === 429) {
      return { valid: false, error: 'Source rate limited (429)', statusCode: response.status };
    }
    
    return { valid: false, error: `Source returned ${response.status}`, statusCode: response.status };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Source timeout' };
    }
    return { valid: false, error: error.message };
  }
}

// Upload to Cloudflare Stream using URL copy
async function uploadToCloudflareStream(
  url: string,
  channelName: string,
  channelId: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  log('info', 'Initiating CF Stream copy', { channelId, url: url.substring(0, 60) + '...' });

  try {
    const copyPayload = {
      url: url,
      meta: {
        name: channelName,
        channel_id: channelId,
        source: 'iptvlink-scheduler',
        uploaded_at: new Date().toISOString(),
      },
      requireSignedURLs: false,
      allowedOrigins: ["*"],
    };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copyPayload),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message || `HTTP ${response.status}`;
      log('error', 'CF copy request failed', { error: errorMsg, status: response.status });
      return { success: false, error: errorMsg };
    }

    const uid = data.result?.uid;
    if (!uid) {
      return { success: false, error: 'No UID returned from Cloudflare' };
    }

    log('info', 'CF copy initiated successfully', { uid, channelId });
    return { success: true, uid };

  } catch (error: any) {
    log('error', 'CF upload exception', { error: error.message, channelId });
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get("x-supabase-cron-secret");
    const authHeader = req.headers.get("authorization");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    
    // Debug logging (masking sensitive data)
    log('info', 'Auth check', { 
      hasCronSecret: !!cronSecret,
      hasExpectedSecret: !!expectedCronSecret,
      hasAuthHeader: !!authHeader,
      cronSecretLength: cronSecret?.length || 0,
      expectedSecretLength: expectedCronSecret?.length || 0,
      secretsMatch: cronSecret && expectedCronSecret ? cronSecret === expectedCronSecret : false
    });
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authentication - either valid cron secret or admin JWT
    let isAuthenticated = false;

    // Check cron secret first (for automated cron jobs)
    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthenticated = true;
      log('info', 'Authenticated via CRON_SECRET');
    }

    // If no valid cron secret, check JWT
    if (!isAuthenticated) {
      if (!authHeader) {
        log('warn', 'No authentication provided - cron secret validation failed');
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (!user) {
        log('warn', 'Invalid JWT token');
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
      if (!isAdmin) {
        log('warn', 'User is not admin', { userId: user.id });
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      isAuthenticated = true;
      log('info', 'Authenticated via admin JWT', { userId: user.id });
    }

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      return new Response(JSON.stringify({ error: "Cloudflare credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runStartTime = Date.now();
    log('info', '=== Starting scheduler run ===', { config: CONFIG });

    const result = {
      statusChecked: 0,
      statusUpdated: 0,
      statusReady: 0,
      statusError: 0,
      newUploads: 0,
      newQueued: 0,
      retriesScheduled: 0,
      sourceValidationFailed: 0,
      resetStuck: 0,
      activeUploads: 0,
      errors: [] as string[],
    };

    // ========================================
    // STEP 1: Check status of processing uploads
    // ========================================
    const { data: processingUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, cf_stream_uid, channel_id, retry_count, metadata, original_url")
      .eq("status", "processing")
      .limit(50);

    result.statusChecked = processingUploads?.length || 0;
    log('info', `Checking ${result.statusChecked} processing uploads`);

    for (const upload of processingUploads || []) {
      if (!upload.cf_stream_uid) continue;

      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${upload.cf_stream_uid}`,
          { headers: { "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` } }
        );

        const cfData = await cfResponse.json();
        
        if (cfData.success && cfData.result) {
          const res = cfData.result;
          const state = res.status?.state;
          const isReady = res.readyToStream || state === "ready";
          const isError = state === "error";
          const progress = res.status?.pctComplete || 0;

          if (isReady) {
            const playbackUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${upload.cf_stream_uid}/manifest/video.m3u8`;

            await supabase.from("m3u_channels").update({
              cf_stream_status: "ready",
              cf_stream_url: playbackUrl,
              cf_stream_duration_seconds: res.duration ? Math.floor(res.duration) : null,
              cf_stream_size_bytes: res.size || null,
            }).eq("id", upload.channel_id);

            await supabase.from("cf_stream_uploads").update({
              status: "ready",
              progress_percent: 100,
              completed_at: new Date().toISOString(),
              metadata: res,
            }).eq("id", upload.id);

            result.statusReady++;
            result.statusUpdated++;
            log('info', 'Upload ready', { uid: upload.cf_stream_uid });

          } else if (isError) {
            const errorMsg = res.status?.errorReasonText || "Encoding failed";
            const errorCategory = categorizeError(errorMsg);
            const isEncodingError = errorMsg.toLowerCase().includes('unknown cause') || 
                                    errorMsg.toLowerCase().includes('encoding');
            const encodingFailures = (upload.metadata?.encoding_failures || 0) + 1;
            const currentRetries = upload.retry_count || 0;
            
            // After 2 encoding failures, fallback to R2 download instead of retrying Stream
            if (isEncodingError && encodingFailures >= 2) {
              log('warn', 'Multiple encoding failures, marking for R2 fallback', { 
                uid: upload.cf_stream_uid, 
                encodingFailures,
              });
              
              await supabase.from("cf_stream_uploads").update({
                status: "needs_r2_fallback",
                error_message: `CF Stream encoding failed ${encodingFailures}x - queued for R2 download`,
                metadata: { 
                  last_cf_uid: upload.cf_stream_uid,
                  last_error: errorMsg,
                  error_category: errorCategory.category,
                  encoding_failures: encodingFailures,
                  fallback_reason: 'repeated_encoding_failure',
                },
              }).eq("id", upload.id);
              
              // Also create R2 download job if r2_download_jobs table exists
              try {
                await supabase.from("r2_download_jobs").insert({
                  channel_id: upload.channel_id,
                  source_url: upload.original_url,
                  priority: 10, // High priority for fallback
                  status: 'queued',
                  metadata: {
                    cf_upload_id: upload.id,
                    fallback_from_stream: true,
                  },
                });
                log('info', 'Created R2 fallback job', { channelId: upload.channel_id });
              } catch (r2Err) {
                log('warn', 'Could not create R2 job (table may not exist)', { error: r2Err.message });
              }
              
              result.statusError++;
              
            } else if (errorCategory.shouldRetry && currentRetries < CONFIG.MAX_RETRIES) {
              // Schedule retry - keep UID for first retry, clear after
              const nextRetry = calculateNextRetryTime(currentRetries, errorCategory.delayMultiplier);
              const shouldKeepUid = currentRetries < 1 && isEncodingError;
              
              await supabase.from("cf_stream_uploads").update({
                status: "retry_scheduled",
                error_message: `${errorMsg} (will retry at ${nextRetry.toISOString()})`,
                retry_count: currentRetries + 1,
                cf_stream_uid: shouldKeepUid ? upload.cf_stream_uid : null,
                metadata: { 
                  last_error: errorMsg,
                  error_category: errorCategory.category,
                  next_retry: nextRetry.toISOString(),
                  retry_count: currentRetries + 1,
                  encoding_failures: isEncodingError ? encodingFailures : 0,
                  last_cf_uid: upload.cf_stream_uid,
                },
              }).eq("id", upload.id);

              result.retriesScheduled++;
              log('warn', 'Encoding failed, retry scheduled', { 
                uid: upload.cf_stream_uid, 
                error: errorMsg,
                nextRetry: nextRetry.toISOString(),
                encodingFailures,
                keptUid: shouldKeepUid,
              });
            } else {
              // Max retries exceeded or permanent error
              await supabase.from("cf_stream_uploads").update({
                status: "error",
                error_message: errorMsg,
                metadata: { 
                  last_error: errorMsg, 
                  error_category: errorCategory.category,
                  final_failure: true,
                  last_cf_uid: upload.cf_stream_uid,
                },
              }).eq("id", upload.id);
              
              await supabase.from("m3u_channels").update({
                cf_stream_status: "error",
              }).eq("id", upload.channel_id);

              result.statusError++;
              log('error', 'Upload failed permanently', { uid: upload.cf_stream_uid, error: errorMsg });
            }
          } else {
            // Still processing - update progress
            await supabase.from("cf_stream_uploads").update({
              progress_percent: progress,
            }).eq("id", upload.id);
          }
        }
      } catch (err: any) {
        log('error', 'Status check exception', { uid: upload.cf_stream_uid, error: err.message });
      }
    }

    // ========================================
    // STEP 2: Process retry_scheduled uploads (if their time has come)
    // ========================================
    const { data: retryUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, channel_id, original_url, retry_count, metadata")
      .eq("status", "retry_scheduled")
      .limit(5);

    for (const upload of retryUploads || []) {
      const nextRetryTime = upload.metadata?.next_retry;
      if (nextRetryTime && new Date(nextRetryTime) > new Date()) {
        continue; // Not time yet
      }

      // Move back to queued for processing
      await supabase.from("cf_stream_uploads").update({
        status: "queued",
        error_message: null,
        started_at: null,
      }).eq("id", upload.id);

      log('info', 'Retry upload moved to queue', { uploadId: upload.id, retryCount: upload.retry_count });
    }

    // ========================================
    // STEP 3: Count active uploads
    // ========================================
    const { count: activeCount } = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .in("status", ["uploading", "processing"]);

    result.activeUploads = activeCount || 0;
    const availableSlots = Math.max(0, CONFIG.MAX_CONCURRENT_UPLOADS - result.activeUploads);
    log('info', `Active uploads: ${result.activeUploads}, Available slots: ${availableSlots}`);

    // ========================================
    // STEP 4: Process queued uploads
    // ========================================
    if (availableSlots > 0) {
      const { data: queuedUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, original_url, retry_count")
        .eq("status", "queued")
        .order("retry_count", { ascending: true }) // Prioritize fresh uploads
        .order("created_at", { ascending: true })
        .limit(availableSlots);

      for (const upload of queuedUploads || []) {
        try {
          // Validate source URL first
          log('info', 'Validating source URL', { channelId: upload.channel_id });
          const validation = await validateSourceUrl(upload.original_url);
          
          if (!validation.valid) {
            log('warn', 'Source validation failed', { 
              channelId: upload.channel_id, 
              error: validation.error,
              statusCode: validation.statusCode,
            });

            const errorCategory = categorizeError(validation.error || '');
            
            if (errorCategory.shouldRetry && (upload.retry_count || 0) < CONFIG.MAX_RETRIES) {
              const nextRetry = calculateNextRetryTime(upload.retry_count || 0, 2);
              await supabase.from("cf_stream_uploads").update({
                status: "retry_scheduled",
                error_message: `Source validation failed: ${validation.error}`,
                retry_count: (upload.retry_count || 0) + 1,
                metadata: {
                  validation_error: validation.error,
                  status_code: validation.statusCode,
                  next_retry: nextRetry.toISOString(),
                },
              }).eq("id", upload.id);
              result.retriesScheduled++;
            } else {
              await supabase.from("cf_stream_uploads").update({
                status: "validation_failed",
                error_message: `Source unreachable: ${validation.error}`,
              }).eq("id", upload.id);
            }
            
            result.sourceValidationFailed++;
            continue;
          }

          // Get channel name
          const { data: channel } = await supabase
            .from("m3u_channels")
            .select("name")
            .eq("id", upload.channel_id)
            .maybeSingle();

          const channelName = channel?.name || upload.channel_id;

          // Mark as uploading
          await supabase.from("cf_stream_uploads").update({
            status: "uploading",
            started_at: new Date().toISOString(),
            error_message: null,
          }).eq("id", upload.id);

          // Upload to Cloudflare Stream
          const uploadResult = await uploadToCloudflareStream(
            upload.original_url,
            channelName,
            upload.channel_id
          );

          if (uploadResult.success && uploadResult.uid) {
            await supabase.from("cf_stream_uploads").update({
              cf_stream_uid: uploadResult.uid,
              status: "processing",
              upload_type: "copy",
            }).eq("id", upload.id);

            await supabase.from("m3u_channels").update({
              cf_stream_uid: uploadResult.uid,
              cf_stream_status: "processing",
              cf_stream_uploaded_at: new Date().toISOString(),
            }).eq("id", upload.channel_id);

            result.newUploads++;
            log('info', 'Upload started', { channelId: upload.channel_id, uid: uploadResult.uid });

          } else {
            // Handle upload failure
            const errorCategory = categorizeError(uploadResult.error || '');
            const newRetryCount = (upload.retry_count || 0) + 1;

            if (errorCategory.shouldRetry && newRetryCount < CONFIG.MAX_RETRIES) {
              const nextRetry = calculateNextRetryTime(newRetryCount, errorCategory.delayMultiplier);
              
              await supabase.from("cf_stream_uploads").update({
                status: "retry_scheduled",
                error_message: uploadResult.error,
                retry_count: newRetryCount,
                started_at: null,
                metadata: {
                  error_category: errorCategory.category,
                  next_retry: nextRetry.toISOString(),
                },
              }).eq("id", upload.id);

              result.retriesScheduled++;
            } else {
              await supabase.from("cf_stream_uploads").update({
                status: "error",
                error_message: uploadResult.error,
                retry_count: newRetryCount,
                started_at: null,
              }).eq("id", upload.id);
            }

            result.errors.push(`${upload.channel_id}: ${uploadResult.error}`);
          }

          // Delay between uploads to avoid overwhelming origin
          if ((queuedUploads || []).indexOf(upload) < (queuedUploads || []).length - 1) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_UPLOADS_MS));
          }

        } catch (err: any) {
          log('error', 'Upload processing error', { uploadId: upload.id, error: err.message });
          await supabase.from("cf_stream_uploads").update({
            status: "error",
            error_message: err.message,
          }).eq("id", upload.id);
        }
      }
    }

    // ========================================
    // STEP 5: Queue new VODs (conservative)
    // ========================================
    const { count: pendingCount } = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "retry_scheduled", "uploading", "processing"]);

    if ((pendingCount || 0) < CONFIG.BATCH_SIZE) {
      const slotsForNew = CONFIG.BATCH_SIZE - (pendingCount || 0);
      
      const { data: vodsToQueue } = await supabase
        .from("m3u_channels")
        .select("id, stream_url")
        .eq("is_vod", true)
        .is("cf_stream_uid", null)
        .is("r2_url", null)
        .limit(slotsForNew);

      for (const vod of vodsToQueue || []) {
        // Check if already has an upload record
        const { count: existingCount } = await supabase
          .from("cf_stream_uploads")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", vod.id);

        if (!existingCount) {
          await supabase.from("cf_stream_uploads").insert({
            channel_id: vod.id,
            original_url: vod.stream_url,
            status: "queued",
            upload_type: "copy",
          });
          result.newQueued++;
        }
      }
    }

    // ========================================
    // STEP 6: Reset stuck uploads (uploading state)
    // ========================================
    const stuckTime = new Date(Date.now() - CONFIG.STUCK_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    
    const { data: stuckUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, retry_count")
      .eq("status", "uploading")
      .lt("started_at", stuckTime);

    for (const stuck of stuckUploads || []) {
      if ((stuck.retry_count || 0) < CONFIG.MAX_RETRIES) {
        await supabase.from("cf_stream_uploads").update({
          status: "queued",
          started_at: null,
          retry_count: (stuck.retry_count || 0) + 1,
          error_message: "Reset: stuck in uploading state",
        }).eq("id", stuck.id);
        result.resetStuck++;
        log('info', 'Reset stuck upload (uploading)', { id: stuck.id });
      } else {
        await supabase.from("cf_stream_uploads").update({
          status: "error",
          error_message: "Max retries exceeded after being stuck",
        }).eq("id", stuck.id);
      }
    }

    // ========================================
    // STEP 7: Reset legacy "downloading" status
    // ========================================
    const downloadingStuckTime = new Date(Date.now() - CONFIG.DOWNLOADING_STUCK_MINUTES * 60 * 1000).toISOString();
    
    const { data: downloadingStuck } = await supabase
      .from("cf_stream_uploads")
      .select("id, retry_count, updated_at")
      .eq("status", "downloading")
      .lt("updated_at", downloadingStuckTime);

    for (const stuck of downloadingStuck || []) {
      await supabase.from("cf_stream_uploads").update({
        status: "queued",
        started_at: null,
        error_message: "Reset: legacy downloading status converted to queue",
      }).eq("id", stuck.id);
      result.resetStuck++;
      log('info', 'Reset stuck download (downloading)', { id: stuck.id });
    }

    // ========================================
    // STEP 8: Performance metrics logging
    // ========================================
    const runEndTime = Date.now();
    const runDuration = runEndTime - runStartTime;
    
    log('info', '=== Scheduler completed ===', {
      ...result,
      performance: {
        durationMs: runDuration,
        uploadsPerSecond: result.newUploads / (runDuration / 1000),
      }
    });

    return new Response(JSON.stringify({
      success: true,
      ...result,
      summary: {
        checked: result.statusChecked,
        ready: result.statusReady,
        errors: result.statusError,
        newUploads: result.newUploads,
        retries: result.retriesScheduled,
        active: result.activeUploads,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log('error', 'Scheduler fatal error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
