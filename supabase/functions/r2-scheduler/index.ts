import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration - Mirror cf-stream-scheduler
const CONFIG = {
  MAX_CONCURRENT_DOWNLOADS: 3,
  BATCH_SIZE: 10,
  DELAY_BETWEEN_DOWNLOADS_MS: 2000,
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY_MS: 60000,
  SOURCE_VALIDATION_TIMEOUT_MS: 10000,
  STUCK_TIMEOUT_MINUTES: 30,
};

const ERROR_CATEGORIES = {
  SOURCE_UNREACHABLE: 'source_unreachable',
  DOWNLOAD_FAILED: 'download_failed',
  UPLOAD_FAILED: 'upload_failed',
  RATE_LIMITED: 'rate_limited',
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
};

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][R2-Scheduler][${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

function categorizeError(errorMessage: string): { category: string; shouldRetry: boolean; delayMultiplier: number } {
  const msg = (errorMessage || '').toLowerCase();
  
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
    return { category: ERROR_CATEGORIES.RATE_LIMITED, shouldRetry: true, delayMultiplier: 4 };
  }
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('connection')) {
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
  const exponentialDelay = baseDelay * Math.pow(2, retryCount) * delayMultiplier;
  const jitter = Math.random() * 30000;
  const totalDelay = Math.min(exponentialDelay + jitter, 3600000);
  return new Date(Date.now() + totalDelay);
}

async function validateSourceUrl(url: string): Promise<{ valid: boolean; error?: string; statusCode?: number; contentLength?: number }> {
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
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Source timeout' };
    }
    return { valid: false, error: error.message };
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
    
    log('info', 'Auth check', { 
      hasCronSecret: !!cronSecret,
      hasExpectedSecret: !!expectedCronSecret,
      secretsMatch: cronSecret && expectedCronSecret ? cronSecret === expectedCronSecret : false
    });
    
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

    const runStartTime = Date.now();
    log('info', '=== Starting R2 scheduler run ===', { config: CONFIG });

    const result = {
      statusChecked: 0,
      statusUpdated: 0,
      statusCompleted: 0,
      statusError: 0,
      newJobs: 0,
      retriesScheduled: 0,
      sourceValidationFailed: 0,
      resetStuck: 0,
      activeJobs: 0,
      errors: [] as string[],
    };

    // ========================================
    // STEP 1: Check status of processing jobs
    // ========================================
    const { data: processingJobs } = await supabase
      .from("r2_download_jobs")
      .select("id, channel_id, status, retry_count, updated_at")
      .in("status", ["downloading", "uploading", "processing"])
      .limit(50);

    result.statusChecked = processingJobs?.length || 0;
    log('info', `Checking ${result.statusChecked} processing jobs`);

    // Check for stuck jobs
    const stuckThreshold = new Date(Date.now() - CONFIG.STUCK_TIMEOUT_MINUTES * 60 * 1000);
    
    for (const job of processingJobs || []) {
      const updatedAt = new Date(job.updated_at);
      
      if (updatedAt < stuckThreshold) {
        const errorCategory = categorizeError('stuck timeout');
        
        if (errorCategory.shouldRetry && (job.retry_count || 0) < CONFIG.MAX_RETRIES) {
          const nextRetry = calculateNextRetryTime(job.retry_count || 0, 1);
          
          await supabase.from("r2_download_jobs").update({
            status: "retry_scheduled",
            error_message: `Job stuck for ${CONFIG.STUCK_TIMEOUT_MINUTES} minutes`,
            retry_count: (job.retry_count || 0) + 1,
            next_retry_at: nextRetry.toISOString(),
          }).eq("id", job.id);

          result.retriesScheduled++;
          log('warn', 'Stuck job scheduled for retry', { jobId: job.id, nextRetry: nextRetry.toISOString() });
        } else {
          await supabase.from("r2_download_jobs").update({
            status: "failed",
            error_message: "Job stuck - max retries exceeded",
          }).eq("id", job.id);
          
          result.statusError++;
        }
        result.resetStuck++;
      }
    }

    // ========================================
    // STEP 2: Process retry_scheduled jobs
    // ========================================
    const { data: retryJobs } = await supabase
      .from("r2_download_jobs")
      .select("id, channel_id, original_url, retry_count, next_retry_at")
      .eq("status", "retry_scheduled")
      .lt("next_retry_at", new Date().toISOString())
      .limit(5);

    for (const job of retryJobs || []) {
      await supabase.from("r2_download_jobs").update({
        status: "queued",
        error_message: null,
        started_at: null,
      }).eq("id", job.id);

      log('info', 'Retry job moved to queue', { jobId: job.id, retryCount: job.retry_count });
    }

    // ========================================
    // STEP 3: Count active jobs
    // ========================================
    const { count: activeCount } = await supabase
      .from("r2_download_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["downloading", "uploading", "processing", "validating"]);

    // Also count vod_downloads
    const { count: vodActiveCount } = await supabase
      .from("vod_downloads")
      .select("*", { count: "exact", head: true })
      .in("status", ["downloading", "processing"]);

    result.activeJobs = (activeCount || 0) + (vodActiveCount || 0);
    const availableSlots = Math.max(0, CONFIG.MAX_CONCURRENT_DOWNLOADS - result.activeJobs);
    log('info', `Active jobs: ${result.activeJobs}, Available slots: ${availableSlots}`);

    // ========================================
    // STEP 4: Process CF Stream fallbacks (HIGH PRIORITY)
    // ========================================
    let usedSlots = 0;
    
    if (availableSlots > 0) {
      const { data: fallbackUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, original_url, metadata")
        .eq("status", "needs_r2_fallback")
        .order("created_at", { ascending: true })
        .limit(availableSlots);

      for (const upload of fallbackUploads || []) {
        log('info', 'Processing CF Stream fallback', { channelId: upload.channel_id });
        
        // Validate source
        const validation = await validateSourceUrl(upload.original_url);
        
        if (!validation.valid) {
          log('warn', 'Fallback source validation failed', { 
            channelId: upload.channel_id, 
            error: validation.error 
          });
          
          await supabase.from("cf_stream_uploads").update({
            status: "error",
            error_message: `R2 fallback failed - source unreachable: ${validation.error}`,
          }).eq("id", upload.id);
          
          result.sourceValidationFailed++;
          continue;
        }

        // Create R2 job
        const { error: insertError } = await supabase
          .from("r2_download_jobs")
          .insert({
            channel_id: upload.channel_id,
            source_url: upload.original_url,
            status: "queued",
            priority: 10, // High priority
            total_bytes: validation.contentLength || null,
            metadata: { 
              cf_upload_id: upload.id,
              fallback_from_stream: true,
              original_cf_metadata: upload.metadata,
            }
          });

        if (!insertError) {
          // Update CF upload status
          await supabase.from("cf_stream_uploads").update({
            status: "r2_fallback_queued",
            error_message: "Queued for R2 download",
          }).eq("id", upload.id);

          // Trigger download-vod function
          try {
            await supabase.functions.invoke('download-vod', {
              body: { channelId: upload.channel_id }
            });
            log('info', 'R2 fallback download triggered', { channelId: upload.channel_id });
          } catch (e: any) {
            log('warn', 'Failed to trigger fallback download', { error: e.message });
          }

          result.newJobs++;
          usedSlots++;
          log('info', 'R2 fallback job created', { channelId: upload.channel_id });
        }

        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_DOWNLOADS_MS));
      }
    }

    // ========================================
    // STEP 5: Auto-queue new candidates (if slots available)
    // ========================================
    const remainingNewSlots = availableSlots - usedSlots;
    
    if (remainingNewSlots > 0) {
      // Get R2 candidates
      const { data: candidates } = await supabase
        .rpc('get_r2_download_candidates', { p_limit: remainingNewSlots * 2 });

      for (const candidate of (candidates || []).slice(0, remainingNewSlots)) {
        // Validate source first
        log('info', 'Validating source URL', { channelId: candidate.channel_id });
        const validation = await validateSourceUrl(candidate.stream_url);
        
        if (!validation.valid) {
          log('warn', 'Source validation failed', { 
            channelId: candidate.channel_id, 
            error: validation.error 
          });
          result.sourceValidationFailed++;
          continue;
        }

        // Create job
        const { data: newJob, error: insertError } = await supabase
          .from("r2_download_jobs")
          .insert({
            channel_id: candidate.channel_id,
            original_url: candidate.stream_url,
            status: "queued",
            total_bytes: validation.contentLength || null,
            metadata: { reason: candidate.reason, demand_score: candidate.demand_score }
          })
          .select()
          .single();

        if (!insertError && newJob) {
          result.newJobs++;
          log('info', 'New R2 job queued', { 
            channelId: candidate.channel_id, 
            reason: candidate.reason 
          });

          // Trigger download-vod function
          try {
            await supabase.functions.invoke('download-vod', {
              body: { channelId: candidate.channel_id }
            });
            log('info', 'Download triggered', { channelId: candidate.channel_id });
          } catch (e: any) {
            log('warn', 'Failed to trigger download', { error: e.message });
          }
        }

        // Delay between jobs
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_DOWNLOADS_MS));
      }
    }

    // ========================================
    // STEP 6: Process queued jobs
    // ========================================
    if (availableSlots > result.newJobs) {
      const remainingSlots = availableSlots - result.newJobs;
      
      const { data: queuedJobs } = await supabase
        .from("r2_download_jobs")
        .select("id, channel_id, original_url, retry_count")
        .eq("status", "queued")
        .order("retry_count", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(remainingSlots);

      for (const job of queuedJobs || []) {
        // Validate source
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
          continue;
        }

        // Trigger download
        try {
          await supabase.from("r2_download_jobs").update({
            status: "validating",
            started_at: new Date().toISOString(),
          }).eq("id", job.id);

          await supabase.functions.invoke('download-vod', {
            body: { channelId: job.channel_id }
          });
          
          result.newJobs++;
          log('info', 'Download started', { channelId: job.channel_id, jobId: job.id });
        } catch (e: any) {
          await supabase.from("r2_download_jobs").update({
            status: "failed",
            error_message: e.message,
          }).eq("id", job.id);
          result.statusError++;
        }

        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_DOWNLOADS_MS));
      }
    }

    // ========================================
    // STEP 7: Sync completed vod_downloads to r2_download_jobs
    // ========================================
    const { data: completedVods } = await supabase
      .from("vod_downloads")
      .select("channel_id, r2_url, download_completed_at, file_size_bytes")
      .eq("status", "completed")
      .limit(100);

    for (const vod of completedVods || []) {
      // Update corresponding r2_download_job if exists
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
    }

    const runDuration = Date.now() - runStartTime;
    log('info', '=== R2 Scheduler completed ===', {
      ...result,
      performance: {
        durationMs: runDuration,
        jobsPerSecond: result.newJobs / (runDuration / 1000),
      }
    });

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: runDuration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log('error', 'Scheduler error', { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
