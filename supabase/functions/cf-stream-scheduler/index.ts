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

// Configuration - Aggressive settings for high throughput
const CONFIG = {
  MAX_CONCURRENT_UPLOADS: 100, // Increased from 5 to 100 for parallel uploads
  BATCH_SIZE: 100, // Process 100 items per batch
  DELAY_BETWEEN_UPLOADS_MS: 500, // Reduced to 500ms for faster throughput
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY_MS: 30000, // 30 seconds base delay
  SOURCE_VALIDATION_TIMEOUT_MS: 15000, // 15 seconds
  STUCK_TIMEOUT_MINUTES: 60, // 60 minutes timeout for stuck uploads
  DOWNLOADING_STUCK_MINUTES: 30,
  PARALLEL_STATUS_CHECKS: 20, // Check 20 statuses in parallel
  PARALLEL_UPLOADS: 10, // Upload 10 at a time
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
  const jitter = Math.random() * 15000; // Add up to 15 seconds jitter
  const totalDelay = Math.min(exponentialDelay + jitter, 1800000); // Cap at 30 minutes
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
  try {
    const copyPayload = {
      url: url,
      meta: {
        name: channelName,
        channel_id: channelId,
        source: 'iptvlink-scheduler-v2',
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
      return { success: false, error: errorMsg };
    }

    const uid = data.result?.uid;
    if (!uid) {
      return { success: false, error: 'No UID returned from Cloudflare' };
    }

    return { success: true, uid };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Check status of a single upload from Cloudflare
async function checkCloudflareStatus(cfStreamUid: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${cfStreamUid}`,
      { headers: { "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` } }
    );
    return await response.json();
  } catch (error) {
    return { success: false, error };
  }
}

// Process uploads in parallel batches
async function processUploadsInParallel<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  parallelCount: number
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += parallelCount) {
    chunks.push(items.slice(i, i + parallelCount));
  }
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(processor));
    // Small delay between batches to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_UPLOADS_MS));
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
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authentication
    let isAuthenticated = false;

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthenticated = true;
      log('info', 'Authenticated via CRON_SECRET');
    }

    if (!isAuthenticated) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
      if (!isAdmin) {
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
    log('info', '=== Starting aggressive scheduler run ===', { config: CONFIG });

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
    // STEP 1: Check status of processing uploads (parallel)
    // ========================================
    const { data: processingUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, cf_stream_uid, channel_id, retry_count, metadata, original_url")
      .eq("status", "processing")
      .limit(100);

    result.statusChecked = processingUploads?.length || 0;
    log('info', `Checking ${result.statusChecked} processing uploads in parallel`);

    // Process status checks in parallel
    await processUploadsInParallel(
      processingUploads || [],
      async (upload) => {
        if (!upload.cf_stream_uid) return;

        try {
          const cfData = await checkCloudflareStatus(upload.cf_stream_uid);
          
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

            } else if (isError) {
              const errorMsg = res.status?.errorReasonText || "Encoding failed";
              const errorCategory = categorizeError(errorMsg);
              const isEncodingError = errorMsg.toLowerCase().includes('unknown cause') || 
                                      errorMsg.toLowerCase().includes('encoding');
              const encodingFailures = (upload.metadata?.encoding_failures || 0) + 1;
              const currentRetries = upload.retry_count || 0;
              
              if (isEncodingError && encodingFailures >= 2) {
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
                
                result.statusError++;
                
              } else if (errorCategory.shouldRetry && currentRetries < CONFIG.MAX_RETRIES) {
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
              } else {
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
              }
            } else {
              await supabase.from("cf_stream_uploads").update({
                progress_percent: progress,
              }).eq("id", upload.id);
            }
          }
        } catch (err: any) {
          log('error', 'Status check exception', { uid: upload.cf_stream_uid, error: err.message });
        }
      },
      CONFIG.PARALLEL_STATUS_CHECKS
    );

    // ========================================
    // STEP 2: Process retry_scheduled uploads
    // ========================================
    const { data: retryUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, channel_id, original_url, retry_count, metadata")
      .eq("status", "retry_scheduled")
      .limit(50);

    for (const upload of retryUploads || []) {
      const nextRetryTime = upload.metadata?.next_retry;
      if (nextRetryTime && new Date(nextRetryTime) > new Date()) {
        continue;
      }

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
    // STEP 4: Process queued uploads (parallel)
    // ========================================
    if (availableSlots > 0) {
      const { data: queuedUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, original_url, retry_count")
        .eq("status", "queued")
        .order("retry_count", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(availableSlots);

      log('info', `Processing ${queuedUploads?.length || 0} queued uploads`);

      await processUploadsInParallel(
        queuedUploads || [],
        async (upload) => {
          try {
            // Skip validation for retries to save time
            if ((upload.retry_count || 0) === 0) {
              const validation = await validateSourceUrl(upload.original_url);
              
              if (!validation.valid) {
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
                return;
              }
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

            } else {
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

          } catch (err: any) {
            log('error', 'Upload processing error', { uploadId: upload.id, error: err.message });
            await supabase.from("cf_stream_uploads").update({
              status: "error",
              error_message: err.message,
            }).eq("id", upload.id);
          }
        },
        CONFIG.PARALLEL_UPLOADS
      );
    }

    // ========================================
    // STEP 5: Queue new VODs aggressively
    // ========================================
    const { count: pendingCount } = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "retry_scheduled", "uploading", "processing"]);

    if ((pendingCount || 0) < CONFIG.BATCH_SIZE) {
      const slotsForNew = CONFIG.BATCH_SIZE - (pendingCount || 0);
      
      // Prioritize Live TV content for Cloudflare Stream
      const { data: vodsToQueue } = await supabase
        .from("m3u_channels")
        .select("id, stream_url, group_title")
        .eq("is_vod", false) // Live content first
        .is("cf_stream_uid", null)
        .is("r2_url", null)
        .limit(slotsForNew);

      for (const vod of vodsToQueue || []) {
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
    // STEP 6: Reset stuck uploads (60 min timeout)
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
          error_message: "Reset: stuck in uploading state (60min timeout)",
        }).eq("id", stuck.id);
        result.resetStuck++;
      } else {
        await supabase.from("cf_stream_uploads").update({
          status: "error",
          error_message: "Max retries exceeded after being stuck",
        }).eq("id", stuck.id);
      }
    }

    // ========================================
    // STEP 7: Reset legacy downloading status
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
    }

    // ========================================
    // STEP 8: Performance metrics
    // ========================================
    const runEndTime = Date.now();
    const runDuration = runEndTime - runStartTime;
    
    log('info', '=== Aggressive scheduler completed ===', {
      ...result,
      performance: {
        durationMs: runDuration,
        uploadsPerSecond: result.newUploads / (runDuration / 1000),
        config: CONFIG,
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
        newQueued: result.newQueued,
        retries: result.retriesScheduled,
        active: result.activeUploads,
        durationMs: runDuration,
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
