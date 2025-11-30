/**
 * ============================================================================
 * Transcode Processor - Job Queue Consumer
 * ============================================================================
 * 
 * Processes transcode jobs from the queue and initiates Cloudflare Stream
 * uploads with dynamic quality ladder rules based on content popularity
 * and source resolution.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// =============================================================================
// TYPES
// =============================================================================

interface TranscodeJob {
  id: string
  channel_id: string
  source_url: string
  source_resolution: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
    codec?: string
  } | null
  ladder_preset: 'basic' | 'standard' | 'premium' | 'ultra'
  ladder_config: object | null
  historical_views: number
  priority: number
  retry_count: number
  max_retries: number
}

interface QualityLadder {
  name: string
  width: number
  height: number
  bitrate: number
  fps: number
}

// =============================================================================
// QUALITY LADDER CONFIGURATIONS
// =============================================================================

const QUALITY_LADDERS: Record<string, QualityLadder[]> = {
  basic: [
    { name: '360p', width: 640, height: 360, bitrate: 800, fps: 30 },
    { name: '480p', width: 854, height: 480, bitrate: 1400, fps: 30 },
  ],
  standard: [
    { name: '360p', width: 640, height: 360, bitrate: 800, fps: 30 },
    { name: '480p', width: 854, height: 480, bitrate: 1400, fps: 30 },
    { name: '720p', width: 1280, height: 720, bitrate: 2800, fps: 30 },
  ],
  premium: [
    { name: '360p', width: 640, height: 360, bitrate: 800, fps: 30 },
    { name: '480p', width: 854, height: 480, bitrate: 1400, fps: 30 },
    { name: '720p', width: 1280, height: 720, bitrate: 2800, fps: 30 },
    { name: '1080p', width: 1920, height: 1080, bitrate: 5000, fps: 30 },
  ],
  ultra: [
    { name: '360p', width: 640, height: 360, bitrate: 800, fps: 30 },
    { name: '480p', width: 854, height: 480, bitrate: 1400, fps: 30 },
    { name: '720p', width: 1280, height: 720, bitrate: 2800, fps: 30 },
    { name: '1080p', width: 1920, height: 1080, bitrate: 5000, fps: 60 },
    { name: '1440p', width: 2560, height: 1440, bitrate: 8000, fps: 60 },
    { name: '4K', width: 3840, height: 2160, bitrate: 16000, fps: 60 },
  ],
}

// =============================================================================
// LOGGER
// =============================================================================

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: object) {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  console.log(`[${timestamp}][TranscodeProcessor][${level}] ${message}${dataStr}`)
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const processorId = `processor-${crypto.randomUUID().slice(0, 8)}`
  log('INFO', 'Processor started', { processorId })

  try {
    // Auth check
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedSecret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('authorization')

    const isAuthorized = 
      (cronSecret && expectedSecret && cronSecret === expectedSecret) ||
      (authHeader?.startsWith('Bearer '))

    if (!isAuthorized) {
      log('WARN', 'Unauthorized request')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get CF credentials
    const cfAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const cfApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN')

    if (!cfAccountId || !cfApiToken) {
      log('ERROR', 'Missing Cloudflare credentials')
      return new Response(
        JSON.stringify({ error: 'Missing Cloudflare credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body for batch size
    let batchSize = 5
    try {
      const body = await req.json()
      batchSize = body.batchSize || 5
    } catch {
      // Use default
    }

    // Process jobs
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      noJobs: false,
      errors: [] as string[],
    }

    for (let i = 0; i < batchSize; i++) {
      // Acquire job atomically
      const { data: jobId, error: acquireError } = await supabase
        .rpc('acquire_transcode_job', { p_processor_id: processorId })

      if (acquireError) {
        log('ERROR', 'Failed to acquire job', { error: acquireError.message })
        results.errors.push(acquireError.message)
        continue
      }

      if (!jobId) {
        log('INFO', 'No more jobs in queue')
        results.noJobs = true
        break
      }

      results.processed++

      // Get full job details
      const { data: job, error: jobError } = await supabase
        .from('transcode_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        log('ERROR', 'Failed to fetch job details', { jobId, error: jobError?.message })
        results.failed++
        continue
      }

      // Process the job
      const success = await processJob(
        supabase,
        job as TranscodeJob,
        cfAccountId,
        cfApiToken,
        processorId
      )

      if (success) {
        results.succeeded++
      } else {
        results.failed++
      }

      // Add delay between jobs
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    log('INFO', 'Processor completed', results)

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    log('ERROR', 'Processor failed', { error: (error as Error).message })
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// =============================================================================
// JOB PROCESSING
// =============================================================================

async function processJob(
  supabase: any,
  job: TranscodeJob,
  cfAccountId: string,
  cfApiToken: string,
  processorId: string
): Promise<boolean> {
  log('INFO', 'Processing job', { 
    jobId: job.id, 
    channelId: job.channel_id,
    ladderPreset: job.ladder_preset,
  })

  try {
    // Calculate optimal ladder based on source resolution and popularity
    const ladder = calculateOptimalLadder(job)
    log('INFO', 'Calculated quality ladder', { 
      jobId: job.id, 
      preset: job.ladder_preset,
      levels: ladder.length,
    })

    // Initiate Cloudflare Stream copy from URL
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: job.source_url,
          meta: {
            jobId: job.id,
            channelId: job.channel_id,
            ladderPreset: job.ladder_preset,
            processorId,
          },
          // Cloudflare handles transcoding automatically
          // We store our ladder config for reference
          requireSignedURLs: false,
          allowedOrigins: ['*'],
        }),
      }
    )

    const cfData = await cfResponse.json()

    if (!cfResponse.ok || !cfData.success) {
      throw new Error(cfData.errors?.[0]?.message || 'Cloudflare API error')
    }

    const cfStreamUid = cfData.result.uid

    // Update job with CF stream UID
    const { error: updateError } = await supabase
      .from('transcode_jobs')
      .update({
        cf_stream_uid: cfStreamUid,
        cf_upload_id: cfData.result.uploadId || null,
        ladder_config: { ladder, originalPreset: job.ladder_preset },
      })
      .eq('id', job.id)

    if (updateError) {
      log('WARN', 'Failed to update job with CF UID', { 
        jobId: job.id, 
        error: updateError.message 
      })
    }

    // Also update cf_stream_uploads if exists
    await supabase
      .from('cf_stream_uploads')
      .update({
        cf_stream_uid: cfStreamUid,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('channel_id', job.channel_id)

    log('INFO', 'Job submitted to Cloudflare', { 
      jobId: job.id, 
      cfStreamUid,
    })

    return true

  } catch (error) {
    log('ERROR', 'Job processing failed', { 
      jobId: job.id, 
      error: (error as Error).message,
    })

    // Handle retry logic
    if (job.retry_count < job.max_retries) {
      const retryDelay = Math.pow(2, job.retry_count) * 60000 // Exponential backoff
      const retryAfter = new Date(Date.now() + retryDelay)

      await supabase
        .from('transcode_jobs')
        .update({
          status: 'queued',
          processor_id: null,
          retry_count: job.retry_count + 1,
          retry_after: retryAfter.toISOString(),
          error_message: (error as Error).message,
        })
        .eq('id', job.id)

      log('INFO', 'Job scheduled for retry', { 
        jobId: job.id, 
        retryCount: job.retry_count + 1,
        retryAfter: retryAfter.toISOString(),
      })
    } else {
      // Max retries exceeded
      await supabase.rpc('update_transcode_job_status', {
        p_job_id: job.id,
        p_new_status: 'failed',
        p_changed_by: processorId,
        p_metadata: { error: (error as Error).message, maxRetriesExceeded: true },
      })

      log('ERROR', 'Job failed permanently', { jobId: job.id })
    }

    return false
  }
}

// =============================================================================
// QUALITY LADDER CALCULATION
// =============================================================================

function calculateOptimalLadder(job: TranscodeJob): QualityLadder[] {
  const baseLadder = QUALITY_LADDERS[job.ladder_preset] || QUALITY_LADDERS.standard
  
  // If we have source resolution info, filter out higher resolutions
  if (job.source_resolution?.width && job.source_resolution?.height) {
    const sourceWidth = job.source_resolution.width
    const sourceHeight = job.source_resolution.height
    
    return baseLadder.filter(level => 
      level.width <= sourceWidth && level.height <= sourceHeight
    )
  }
  
  return baseLadder
}
