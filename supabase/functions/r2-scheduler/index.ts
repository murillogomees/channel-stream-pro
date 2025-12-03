import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration - Optimized for reliability with timeout protection
const CONFIG = {
  MAX_EXECUTION_TIME_MS: 45000, // 45s max (edge function timeout is 60s)
  MAX_CONCURRENT_DOWNLOADS: 3,
  BATCH_SIZE: 5, // Smaller batches for reliability
  DELAY_BETWEEN_OPERATIONS_MS: 1000, // 1s between operations
  COOLDOWN_EVERY_N_OPERATIONS: 5, // Take break every 5 operations
  COOLDOWN_DURATION_MS: 800, // 800ms cooldown
  VALIDATION_TIMEOUT_MS: 8000, // 8s for validation
  MAX_RETRIES: 15,
  BASE_RETRY_DELAY_MS: 30000,
  STUCK_TIMEOUT_MINUTES: 10,
  DOWNLOADING_STUCK_MINUTES: 8,
  NO_PROGRESS_TIMEOUT_MINUTES: 5,
  AUTO_RESTART_ON_STUCK: true,
  RATE_LIMIT_BACKOFF_MS: 5000,
};

// Execution state
let executionStartTime = 0;
let operationCount = 0;

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const elapsed = executionStartTime ? Date.now() - executionStartTime : 0;
  console.log(`[${timestamp}][${elapsed}ms][R2-Scheduler][${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

// Check if we should stop to avoid timeout
function shouldStopExecution(): boolean {
  return (Date.now() - executionStartTime) >= CONFIG.MAX_EXECUTION_TIME_MS;
}

// Periodic cooldown
async function periodicCooldown(): Promise<void> {
  operationCount++;
  if (operationCount % CONFIG.COOLDOWN_EVERY_N_OPERATIONS === 0) {
    log('debug', `Cooldown after ${operationCount} operations`);
    await new Promise(resolve => setTimeout(resolve, CONFIG.COOLDOWN_DURATION_MS));
  }
}

// Delay between operations
async function operationDelay(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_OPERATIONS_MS));
}

const ERROR_CATEGORIES = {
  SOURCE_UNREACHABLE: 'source_unreachable',
  DOWNLOAD_FAILED: 'download_failed',
  UPLOAD_FAILED: 'upload_failed',
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
  if (msg.includes('network') || msg.includes('connection')) {
    return { category: ERROR_CATEGORIES.TRANSIENT, shouldRetry: true, delayMultiplier: 1 };
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return { category: ERROR_CATEGORIES.SOURCE_UNREACHABLE, shouldRetry: false, delayMultiplier: 0 };
  }
  if (msg.includes('invalid') || msg.includes('unsupported') || msg.includes('corrupt')) {
    return { category: ERROR_CATEGORIES.PERMANENT, shouldRetry: false, delayMultiplier: 0 };
  }
  
  return { category: ERROR_CATEGORIES.TRANSIENT, shouldRetry: true, delayMultiplier: 1 };
}

function calculateNextRetryTime(retryCount: number, delayMultiplier: number): Date {
  const baseDelay = CONFIG.BASE_RETRY_DELAY_MS;
  const exponentialDelay = baseDelay * Math.pow(2, Math.min(retryCount, 5)) * delayMultiplier;
  const jitter = Math.random() * 30000;
  const totalDelay = Math.min(exponentialDelay + jitter, 3600000);
  return new Date(Date.now() + totalDelay);
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
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

async function validateSourceUrl(url: string): Promise<{ valid: boolean; error?: string; statusCode?: number; contentLength?: number }> {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
      },
    }, CONFIG.VALIDATION_TIMEOUT_MS);
    
    if (response.ok || response.status === 200 || response.status === 206) {
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      return { valid: true, statusCode: response.status, contentLength };
    }
    
    if (response.status === 403 || response.status === 401) {
      return { valid: false, error: 'Source requires authentication', statusCode: response.status };
    }
    
    if (response.status === 404) {
      return { valid: false, error: 'Source not found (404)', statusCode: response.status };
    }
    
    return { valid: false, error: `Source returned ${response.status}`, statusCode: response.status };
    
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  executionStartTime = Date.now();
  operationCount = 0;

  try {
    const cronSecret = req.headers.get("x-supabase-cron-secret");
    const authHeader = req.headers.get("authorization");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

    log('info', '=== Starting optimized R2 scheduler ===', { 
      config: {
        maxExecutionMs: CONFIG.MAX_EXECUTION_TIME_MS,
        batchSize: CONFIG.BATCH_SIZE,
      }
    });

    const result = {
      statusChecked: 0,
      statusCompleted: 0,
      statusError: 0,
      newJobs: 0,
      retriesScheduled: 0,
      sourceValidationFailed: 0,
      resetStuck: 0,
      activeJobs: 0,
      stoppedEarly: false,
    };

    // STEP 1: Check stuck processing jobs (including validating)
    if (!shouldStopExecution()) {
      const { data: processingJobs } = await supabase
        .from("r2_download_jobs")
        .select("id, channel_id, status, retry_count, updated_at, original_url")
        .in("status", ["downloading", "uploading", "processing", "validating"])
        .limit(CONFIG.BATCH_SIZE);

      result.statusChecked = processingJobs?.length || 0;
      log('info', `Checking ${result.statusChecked} processing jobs`);

      const stuckThreshold = new Date(Date.now() - CONFIG.STUCK_TIMEOUT_MINUTES * 60 * 1000);
      
      for (const job of processingJobs || []) {
        if (shouldStopExecution()) {
          result.stoppedEarly = true;
          break;
        }

        const updatedAt = new Date(job.updated_at);
        
        if (updatedAt < stuckThreshold) {
          log('warn', `Job stuck in ${job.status}`, { jobId: job.id, channelId: job.channel_id });
          
          // Reset job to queued and trigger download
          await supabase.from("r2_download_jobs").update({
            status: "queued",
            error_message: null,
            started_at: null,
            retry_count: Math.min((job.retry_count || 0) + 1, CONFIG.MAX_RETRIES),
          }).eq("id", job.id);
          
          // Trigger download-vod directly
          try {
            await supabase.functions.invoke('download-vod', {
              body: { channelId: job.channel_id }
            });
            log('info', 'Re-triggered download', { channelId: job.channel_id });
          } catch (e: any) {
            log('warn', 'Failed to trigger download', { error: e.message });
          }
          
          result.resetStuck++;
        }
        
        await periodicCooldown();
      }
    }

    // STEP 2: Check stuck vod_downloads
    if (!shouldStopExecution()) {
      const vodStuckThreshold = new Date(Date.now() - CONFIG.DOWNLOADING_STUCK_MINUTES * 60 * 1000);
      
      const { data: stuckVodDownloads } = await supabase
        .from("vod_downloads")
        .select("id, channel_id, status, updated_at, segments_downloaded, metadata, retry_count")
        .in("status", ["downloading", "processing"])
        .lt("updated_at", vodStuckThreshold.toISOString())
        .limit(CONFIG.BATCH_SIZE);

      for (const vod of stuckVodDownloads || []) {
        if (shouldStopExecution()) {
          result.stoppedEarly = true;
          break;
        }

        log('warn', 'Stuck vod_download detected', { vodId: vod.id, channelId: vod.channel_id });
        
        const currentRetry = vod.retry_count || 0;
        
        if (currentRetry < CONFIG.MAX_RETRIES) {
          await supabase.from("vod_downloads").update({
            status: "queued",
            segments_downloaded: 0,
            error_message: `Auto-restart: no progress for ${CONFIG.DOWNLOADING_STUCK_MINUTES}min`,
            retry_count: currentRetry + 1,
            metadata: { 
              auto_restarted: true, 
              restart_at: new Date().toISOString(),
              previous_segments: vod.segments_downloaded,
            }
          }).eq("id", vod.id);
          
          result.resetStuck++;
          
          try {
            await supabase.functions.invoke('download-vod', {
              body: { channelId: vod.channel_id }
            });
          } catch (e: any) {
            log('warn', 'Failed to re-trigger download', { error: e.message });
          }
        } else {
          await supabase.from("vod_downloads").update({
            status: "failed",
            error_message: `Failed after ${currentRetry} auto-restarts`,
          }).eq("id", vod.id);
          
          result.statusError++;
        }
        
        await periodicCooldown();
        await operationDelay();
      }
    }

    // STEP 3: Process retry_scheduled jobs
    if (!shouldStopExecution()) {
      const { data: retryJobs } = await supabase
        .from("r2_download_jobs")
        .select("id, channel_id, original_url, retry_count, next_retry_at")
        .eq("status", "retry_scheduled")
        .lt("next_retry_at", new Date().toISOString())
        .limit(CONFIG.BATCH_SIZE);

      for (const job of retryJobs || []) {
        if (shouldStopExecution()) {
          result.stoppedEarly = true;
          break;
        }

        await supabase.from("r2_download_jobs").update({
          status: "queued",
          error_message: null,
          started_at: null,
        }).eq("id", job.id);

        log('info', 'Retry job moved to queue', { jobId: job.id });
        await periodicCooldown();
      }
    }

    // STEP 4: Count active jobs
    if (!shouldStopExecution()) {
      const { count: activeCount } = await supabase
        .from("r2_download_jobs")
        .select("*", { count: "exact", head: true })
        .in("status", ["downloading", "uploading", "processing", "validating"]);

      const { count: vodActiveCount } = await supabase
        .from("vod_downloads")
        .select("*", { count: "exact", head: true })
        .in("status", ["downloading", "processing"]);

      result.activeJobs = (activeCount || 0) + (vodActiveCount || 0);
      const availableSlots = Math.max(0, CONFIG.MAX_CONCURRENT_DOWNLOADS - result.activeJobs);
      log('info', `Active: ${result.activeJobs}, Available slots: ${availableSlots}`);

      // STEP 5: Process CF Stream fallbacks (HIGH PRIORITY)
      if (availableSlots > 0 && !shouldStopExecution()) {
        const { data: fallbackUploads } = await supabase
          .from("cf_stream_uploads")
          .select("id, channel_id, original_url, metadata")
          .eq("status", "needs_r2_fallback")
          .order("created_at", { ascending: true })
          .limit(Math.min(availableSlots, CONFIG.BATCH_SIZE));

        for (const upload of fallbackUploads || []) {
          if (shouldStopExecution()) {
            result.stoppedEarly = true;
            break;
          }

          log('info', 'Processing CF Stream fallback', { channelId: upload.channel_id });
          
          const validation = await validateSourceUrl(upload.original_url);
          
          if (!validation.valid) {
            await supabase.from("cf_stream_uploads").update({
              status: "error",
              error_message: `R2 fallback failed - source: ${validation.error}`,
            }).eq("id", upload.id);
            
            result.sourceValidationFailed++;
            await periodicCooldown();
            continue;
          }

          const { error: insertError } = await supabase
            .from("r2_download_jobs")
            .insert({
              channel_id: upload.channel_id,
              source_url: upload.original_url,
              status: "queued",
              priority: 10,
              total_bytes: validation.contentLength || null,
              metadata: { 
                cf_upload_id: upload.id,
                fallback_from_stream: true,
              }
            });

          if (!insertError) {
            await supabase.from("cf_stream_uploads").update({
              status: "r2_fallback_queued",
              error_message: "Queued for R2 download",
            }).eq("id", upload.id);

            try {
              await supabase.functions.invoke('download-vod', {
                body: { channelId: upload.channel_id }
              });
              log('info', 'R2 fallback download triggered', { channelId: upload.channel_id });
            } catch (e: any) {
              log('warn', 'Failed to trigger fallback download', { error: e.message });
            }

            result.newJobs++;
          }

          await periodicCooldown();
          await operationDelay();
        }
      }

      // STEP 6: Process queued jobs
      const usedSlots = result.newJobs;
      const remainingSlots = availableSlots - usedSlots;
      
      if (remainingSlots > 0 && !shouldStopExecution()) {
        const { data: queuedJobs } = await supabase
          .from("r2_download_jobs")
          .select("id, channel_id, original_url, retry_count")
          .eq("status", "queued")
          .order("retry_count", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(Math.min(remainingSlots, CONFIG.BATCH_SIZE));

        for (const job of queuedJobs || []) {
          if (shouldStopExecution()) {
            result.stoppedEarly = true;
            break;
          }

          const validation = await validateSourceUrl(job.original_url);
          
          if (!validation.valid) {
            const errorCategory = categorizeError(validation.error || '');
            
            if (errorCategory.shouldRetry && (job.retry_count || 0) < CONFIG.MAX_RETRIES) {
              const nextRetry = calculateNextRetryTime(job.retry_count || 0, 2);
              await supabase.from("r2_download_jobs").update({
                status: "retry_scheduled",
                error_message: `Source validation failed: ${validation.error}`,
                retry_count: (job.retry_count || 0) + 1,
                next_retry_at: nextRetry.toISOString(),
              }).eq("id", job.id);
              result.retriesScheduled++;
            } else {
              await supabase.from("r2_download_jobs").update({
                status: "failed",
                error_message: `Source unreachable: ${validation.error}`,
                error_category: errorCategory.category,
              }).eq("id", job.id);
            }
            
            result.sourceValidationFailed++;
            await periodicCooldown();
            continue;
          }

          try {
            await supabase.from("r2_download_jobs").update({
              status: "validating",
              started_at: new Date().toISOString(),
            }).eq("id", job.id);

            await supabase.functions.invoke('download-vod', {
              body: { channelId: job.channel_id }
            });
            
            result.newJobs++;
            log('info', 'Download started', { channelId: job.channel_id });
          } catch (e: any) {
            await supabase.from("r2_download_jobs").update({
              status: "failed",
              error_message: e.message,
            }).eq("id", job.id);
            result.statusError++;
          }

          await periodicCooldown();
          await operationDelay();
        }
      }
    }

    // STEP 7: Sync completed vod_downloads
    if (!shouldStopExecution()) {
      const { data: completedVods } = await supabase
        .from("vod_downloads")
        .select("channel_id, r2_url, download_completed_at, file_size_bytes")
        .eq("status", "completed")
        .limit(CONFIG.BATCH_SIZE * 2);

      for (const vod of completedVods || []) {
        if (shouldStopExecution()) {
          result.stoppedEarly = true;
          break;
        }

        const { data: existingJob } = await supabase
          .from("r2_download_jobs")
          .select("id")
          .eq("channel_id", vod.channel_id)
          .in("status", ["queued", "validating", "downloading", "uploading", "processing"])
          .maybeSingle();

        if (existingJob) {
          await supabase.from("r2_download_jobs").update({
            status: "completed",
            r2_url: vod.r2_url,
            completed_at: vod.download_completed_at,
            downloaded_bytes: vod.file_size_bytes,
            progress_percent: 100,
          }).eq("id", existingJob.id);
          result.statusCompleted++;
        }
        
        await periodicCooldown();
      }
    }

    const runDuration = Date.now() - executionStartTime;
    log('info', '=== R2 Scheduler completed ===', {
      ...result,
      durationMs: runDuration,
      stoppedEarly: result.stoppedEarly,
    });

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: runDuration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log('error', 'Scheduler error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ 
      error: error.message,
      durationMs: Date.now() - executionStartTime,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
