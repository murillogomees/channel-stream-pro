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

// Configuration - Optimized for reliability with periodic breaks
const CONFIG = {
  MAX_EXECUTION_TIME_MS: 45000, // 45 seconds max (edge function timeout is 60s)
  MAX_CONCURRENT_UPLOADS: 50, // Reduced for stability
  BATCH_SIZE: 20, // Smaller batches for reliability
  DELAY_BETWEEN_BATCHES_MS: 1000, // 1 second pause between batches
  COOLDOWN_EVERY_N_OPERATIONS: 10, // Take a break every 10 operations
  COOLDOWN_DURATION_MS: 500, // 500ms cooldown
  CF_API_TIMEOUT_MS: 10000, // 10s timeout for CF API calls
  SOURCE_VALIDATION_TIMEOUT_MS: 8000, // 8 seconds for validation
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY_MS: 30000,
  STUCK_TIMEOUT_MINUTES: 60,
  DOWNLOADING_STUCK_MINUTES: 30,
  PARALLEL_STATUS_CHECKS: 5, // Reduced for stability
  PARALLEL_UPLOADS: 3, // Reduced for stability
  RATE_LIMIT_BACKOFF_MS: 5000, // 5s backoff when rate limited
};

// Circuit breaker state
let circuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  cooldownUntil: 0,
};

// Track execution time
let executionStartTime = 0;

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const elapsed = executionStartTime ? Date.now() - executionStartTime : 0;
  console.log(`[${timestamp}][${elapsed}ms][CF-Scheduler][${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

// Check if we should stop execution to avoid timeout
function shouldStopExecution(): boolean {
  const elapsed = Date.now() - executionStartTime;
  return elapsed >= CONFIG.MAX_EXECUTION_TIME_MS;
}

// Periodic cooldown to prevent overwhelming APIs
async function periodicCooldown(operationCount: number): Promise<void> {
  if (operationCount > 0 && operationCount % CONFIG.COOLDOWN_EVERY_N_OPERATIONS === 0) {
    log('debug', `Cooldown after ${operationCount} operations`);
    await new Promise(resolve => setTimeout(resolve, CONFIG.COOLDOWN_DURATION_MS));
  }
}

// Circuit breaker logic
function checkCircuitBreaker(): boolean {
  if (circuitBreakerState.isOpen) {
    if (Date.now() < circuitBreakerState.cooldownUntil) {
      log('warn', 'Circuit breaker is OPEN - skipping CF API calls');
      return false;
    }
    // Reset circuit breaker after cooldown
    circuitBreakerState.isOpen = false;
    circuitBreakerState.failures = 0;
    log('info', 'Circuit breaker reset');
  }
  return true;
}

function recordCircuitBreakerFailure(isRateLimit: boolean) {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailure = Date.now();
  
  if (circuitBreakerState.failures >= 3 || isRateLimit) {
    circuitBreakerState.isOpen = true;
    circuitBreakerState.cooldownUntil = Date.now() + CONFIG.RATE_LIMIT_BACKOFF_MS;
    log('warn', 'Circuit breaker OPENED', { 
      failures: circuitBreakerState.failures, 
      cooldownMs: CONFIG.RATE_LIMIT_BACKOFF_MS 
    });
  }
}

function recordCircuitBreakerSuccess() {
  circuitBreakerState.failures = Math.max(0, circuitBreakerState.failures - 1);
}

// Error categories for better handling
const ERROR_CATEGORIES = {
  SOURCE_UNREACHABLE: 'source_unreachable',
  CF_ENCODING_FAILED: 'cf_encoding_failed', 
  CF_FETCH_FAILED: 'cf_fetch_failed',
  RATE_LIMITED: 'rate_limited',
  TIMEOUT: 'timeout',
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
};

function categorizeError(errorMessage: string): { category: string; shouldRetry: boolean; delayMultiplier: number } {
  const msg = (errorMessage || '').toLowerCase();
  
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
    return { category: ERROR_CATEGORIES.RATE_LIMITED, shouldRetry: true, delayMultiplier: 4 };
  }
  if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('timed out')) {
    return { category: ERROR_CATEGORIES.TIMEOUT, shouldRetry: true, delayMultiplier: 2 };
  }
  if (msg.includes('unknown cause') || msg.includes('encoding failed')) {
    return { category: ERROR_CATEGORIES.CF_ENCODING_FAILED, shouldRetry: true, delayMultiplier: 2 };
  }
  if (msg.includes('fetch') || msg.includes('download') || msg.includes('cannot access')) {
    return { category: ERROR_CATEGORIES.CF_FETCH_FAILED, shouldRetry: true, delayMultiplier: 2 };
  }
  if (msg.includes('network') || msg.includes('connection')) {
    return { category: ERROR_CATEGORIES.TRANSIENT, shouldRetry: true, delayMultiplier: 1 };
  }
  if (msg.includes('invalid') || msg.includes('unsupported') || msg.includes('corrupt')) {
    return { category: ERROR_CATEGORIES.PERMANENT, shouldRetry: false, delayMultiplier: 0 };
  }
  
  return { category: ERROR_CATEGORIES.TRANSIENT, shouldRetry: true, delayMultiplier: 1 };
}

function calculateNextRetryTime(retryCount: number, delayMultiplier: number): Date {
  const baseDelay = CONFIG.BASE_RETRY_DELAY_MS;
  const exponentialDelay = baseDelay * Math.pow(2, retryCount) * delayMultiplier;
  const jitter = Math.random() * 15000;
  const totalDelay = Math.min(exponentialDelay + jitter, 1800000);
  return new Date(Date.now() + totalDelay);
}

// Fetch with timeout and abort
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Validate source URL
async function validateSourceUrl(url: string): Promise<{ valid: boolean; error?: string; statusCode?: number }> {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
      },
    }, CONFIG.SOURCE_VALIDATION_TIMEOUT_MS);
    
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
    return { valid: false, error: error.message };
  }
}

// Upload to Cloudflare Stream with timeout
async function uploadToCloudflareStream(
  url: string,
  channelName: string,
  channelId: string
): Promise<{ success: boolean; uid?: string; error?: string; isRateLimit?: boolean }> {
  if (!checkCircuitBreaker()) {
    return { success: false, error: 'Circuit breaker open - rate limit protection', isRateLimit: true };
  }

  try {
    const copyPayload = {
      url: url,
      meta: {
        name: channelName,
        channel_id: channelId,
        source: 'iptvlink-scheduler-v3',
        uploaded_at: new Date().toISOString(),
      },
      requireSignedURLs: false,
      allowedOrigins: ["*"],
    };

    const response = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copyPayload),
      },
      CONFIG.CF_API_TIMEOUT_MS
    );

    const data = await response.json();

    if (response.status === 429) {
      recordCircuitBreakerFailure(true);
      return { success: false, error: 'Rate limited by Cloudflare', isRateLimit: true };
    }

    if (!response.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message || `HTTP ${response.status}`;
      recordCircuitBreakerFailure(false);
      return { success: false, error: errorMsg };
    }

    const uid = data.result?.uid;
    if (!uid) {
      return { success: false, error: 'No UID returned from Cloudflare' };
    }

    recordCircuitBreakerSuccess();
    return { success: true, uid };

  } catch (error: any) {
    const isTimeout = error.message.includes('timeout');
    recordCircuitBreakerFailure(false);
    return { success: false, error: error.message, isRateLimit: isTimeout };
  }
}

// Check status with timeout
async function checkCloudflareStatus(cfStreamUid: string): Promise<any> {
  if (!checkCircuitBreaker()) {
    return { success: false, error: 'Circuit breaker open' };
  }

  try {
    const response = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${cfStreamUid}`,
      { headers: { "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` } },
      CONFIG.CF_API_TIMEOUT_MS
    );

    if (response.status === 429) {
      recordCircuitBreakerFailure(true);
      return { success: false, error: 'Rate limited' };
    }

    recordCircuitBreakerSuccess();
    return await response.json();
  } catch (error: any) {
    recordCircuitBreakerFailure(false);
    return { success: false, error: error.message };
  }
}

// Process items with periodic breaks and timeout protection
async function processWithBreaks<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  parallelCount: number,
  label: string
): Promise<{ processed: number; stoppedEarly: boolean }> {
  let processed = 0;
  const chunks: T[][] = [];
  
  for (let i = 0; i < items.length; i += parallelCount) {
    chunks.push(items.slice(i, i + parallelCount));
  }
  
  for (const chunk of chunks) {
    // Check timeout before each batch
    if (shouldStopExecution()) {
      log('warn', `${label}: Stopping early due to timeout protection`, { processed, total: items.length });
      return { processed, stoppedEarly: true };
    }

    // Check circuit breaker
    if (circuitBreakerState.isOpen && Date.now() < circuitBreakerState.cooldownUntil) {
      log('warn', `${label}: Pausing due to circuit breaker`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_BACKOFF_MS));
    }

    // Process chunk in parallel
    await Promise.all(chunk.map((item, idx) => processor(item, processed + idx)));
    processed += chunk.length;
    
    // Periodic cooldown between batches
    await periodicCooldown(processed);
    
    // Batch delay
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES_MS));
    }
  }
  
  return { processed, stoppedEarly: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  executionStartTime = Date.now();
  
  // Reset circuit breaker state for new execution
  circuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    cooldownUntil: 0,
  };

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
    }

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      return new Response(JSON.stringify({ error: "Cloudflare credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log('info', '=== Starting optimized scheduler ===', { 
      config: {
        maxExecutionMs: CONFIG.MAX_EXECUTION_TIME_MS,
        parallelUploads: CONFIG.PARALLEL_UPLOADS,
        parallelStatusChecks: CONFIG.PARALLEL_STATUS_CHECKS,
        batchSize: CONFIG.BATCH_SIZE,
      }
    });

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
      stoppedEarly: false,
      circuitBreakerTrips: 0,
    };

    // STEP 1: Check processing uploads
    if (!shouldStopExecution()) {
      const { data: processingUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, cf_stream_uid, channel_id, retry_count, metadata, original_url")
        .eq("status", "processing")
        .limit(CONFIG.BATCH_SIZE);

      log('info', `Checking ${processingUploads?.length || 0} processing uploads`);

      const statusResult = await processWithBreaks(
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
                const currentRetries = upload.retry_count || 0;
                
                if (errorCategory.shouldRetry && currentRetries < CONFIG.MAX_RETRIES) {
                  const nextRetry = calculateNextRetryTime(currentRetries, errorCategory.delayMultiplier);
                  
                  await supabase.from("cf_stream_uploads").update({
                    status: "retry_scheduled",
                    error_message: `${errorMsg} (retry at ${nextRetry.toISOString()})`,
                    retry_count: currentRetries + 1,
                    cf_stream_uid: null,
                    metadata: { 
                      last_error: errorMsg,
                      error_category: errorCategory.category,
                      next_retry: nextRetry.toISOString(),
                      last_cf_uid: upload.cf_stream_uid,
                    },
                  }).eq("id", upload.id);

                  result.retriesScheduled++;
                } else {
                  await supabase.from("cf_stream_uploads").update({
                    status: "error",
                    error_message: errorMsg,
                    metadata: { last_error: errorMsg, final_failure: true },
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
            result.statusChecked++;
          } catch (err: any) {
            log('error', 'Status check error', { uid: upload.cf_stream_uid, error: err.message });
          }
        },
        CONFIG.PARALLEL_STATUS_CHECKS,
        'StatusCheck'
      );

      if (statusResult.stoppedEarly) result.stoppedEarly = true;
    }

    // STEP 2: Process retry_scheduled
    if (!shouldStopExecution()) {
      const { data: retryUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, original_url, retry_count, metadata")
        .eq("status", "retry_scheduled")
        .limit(20);

      for (const upload of retryUploads || []) {
        if (shouldStopExecution()) break;
        
        const nextRetryTime = upload.metadata?.next_retry;
        if (nextRetryTime && new Date(nextRetryTime) > new Date()) {
          continue;
        }

        await supabase.from("cf_stream_uploads").update({
          status: "queued",
          error_message: null,
          started_at: null,
        }).eq("id", upload.id);

        await periodicCooldown(result.retriesScheduled);
      }
    }

    // STEP 3: Count active and process queued
    if (!shouldStopExecution()) {
      const { count: activeCount } = await supabase
        .from("cf_stream_uploads")
        .select("*", { count: "exact", head: true })
        .in("status", ["uploading", "processing"]);

      result.activeUploads = activeCount || 0;
      const availableSlots = Math.max(0, CONFIG.MAX_CONCURRENT_UPLOADS - result.activeUploads);
      log('info', `Active: ${result.activeUploads}, Available slots: ${availableSlots}`);

      if (availableSlots > 0) {
        const { data: queuedUploads } = await supabase
          .from("cf_stream_uploads")
          .select("id, channel_id, original_url, retry_count")
          .eq("status", "queued")
          .order("retry_count", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(Math.min(availableSlots, CONFIG.BATCH_SIZE));

        log('info', `Processing ${queuedUploads?.length || 0} queued uploads`);

        const uploadResult = await processWithBreaks(
          queuedUploads || [],
          async (upload) => {
            try {
              // Validate source for first attempts
              if ((upload.retry_count || 0) === 0) {
                const validation = await validateSourceUrl(upload.original_url);
                
                if (!validation.valid) {
                  await supabase.from("cf_stream_uploads").update({
                    status: "validation_failed",
                    error_message: `Source error: ${validation.error}`,
                  }).eq("id", upload.id);
                  
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

              // Upload to Cloudflare
              const uploadRes = await uploadToCloudflareStream(
                upload.original_url,
                channelName,
                upload.channel_id
              );

              if (uploadRes.success && uploadRes.uid) {
                await supabase.from("cf_stream_uploads").update({
                  cf_stream_uid: uploadRes.uid,
                  status: "processing",
                  upload_type: "copy",
                }).eq("id", upload.id);

                await supabase.from("m3u_channels").update({
                  cf_stream_uid: uploadRes.uid,
                  cf_stream_status: "processing",
                  cf_stream_uploaded_at: new Date().toISOString(),
                }).eq("id", upload.channel_id);

                result.newUploads++;

              } else {
                const errorCategory = categorizeError(uploadRes.error || '');
                const newRetryCount = (upload.retry_count || 0) + 1;

                if (uploadRes.isRateLimit) {
                  result.circuitBreakerTrips++;
                }

                if (errorCategory.shouldRetry && newRetryCount < CONFIG.MAX_RETRIES) {
                  const nextRetry = calculateNextRetryTime(newRetryCount, errorCategory.delayMultiplier);
                  
                  await supabase.from("cf_stream_uploads").update({
                    status: "retry_scheduled",
                    error_message: uploadRes.error,
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
                    error_message: uploadRes.error,
                    retry_count: newRetryCount,
                    started_at: null,
                  }).eq("id", upload.id);
                }
              }

            } catch (err: any) {
              log('error', 'Upload error', { uploadId: upload.id, error: err.message });
              await supabase.from("cf_stream_uploads").update({
                status: "error",
                error_message: err.message,
              }).eq("id", upload.id);
            }
          },
          CONFIG.PARALLEL_UPLOADS,
          'Upload'
        );

        if (uploadResult.stoppedEarly) result.stoppedEarly = true;
      }
    }

    // STEP 4: Reset stuck uploads
    if (!shouldStopExecution()) {
      const stuckTime = new Date(Date.now() - CONFIG.STUCK_TIMEOUT_MINUTES * 60 * 1000).toISOString();
      
      const { data: stuckUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, retry_count")
        .eq("status", "uploading")
        .lt("started_at", stuckTime)
        .limit(10);

      for (const stuck of stuckUploads || []) {
        if ((stuck.retry_count || 0) < CONFIG.MAX_RETRIES) {
          await supabase.from("cf_stream_uploads").update({
            status: "queued",
            started_at: null,
            retry_count: (stuck.retry_count || 0) + 1,
            error_message: "Reset: stuck in uploading (timeout)",
          }).eq("id", stuck.id);
          result.resetStuck++;
        } else {
          await supabase.from("cf_stream_uploads").update({
            status: "error",
            error_message: "Max retries exceeded",
          }).eq("id", stuck.id);
        }
      }

      // Reset downloading status
      const downloadingStuckTime = new Date(Date.now() - CONFIG.DOWNLOADING_STUCK_MINUTES * 60 * 1000).toISOString();
      
      const { data: downloadingStuck } = await supabase
        .from("cf_stream_uploads")
        .select("id")
        .eq("status", "downloading")
        .lt("updated_at", downloadingStuckTime)
        .limit(10);

      for (const stuck of downloadingStuck || []) {
        await supabase.from("cf_stream_uploads").update({
          status: "queued",
          error_message: "Reset: legacy downloading status",
        }).eq("id", stuck.id);
        result.resetStuck++;
      }
    }

    // Final metrics
    const runDuration = Date.now() - executionStartTime;
    
    log('info', '=== Scheduler completed ===', {
      ...result,
      durationMs: runDuration,
      stoppedEarly: result.stoppedEarly,
    });

    return new Response(JSON.stringify({
      success: true,
      ...result,
      summary: {
        durationMs: runDuration,
        stoppedEarly: result.stoppedEarly,
        circuitBreakerTrips: result.circuitBreakerTrips,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log('error', 'Fatal error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      durationMs: Date.now() - executionStartTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
