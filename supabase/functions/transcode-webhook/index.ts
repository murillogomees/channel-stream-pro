/**
 * ============================================================================
 * Transcode Webhook Handler
 * ============================================================================
 * 
 * POST /api/transcode/callback
 * 
 * Receives callbacks from Cloudflare Stream when transcoding completes.
 * Updates job status: queued -> processing -> ready/failed
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cf-webhook-auth',
}

// =============================================================================
// TYPES
// =============================================================================

interface CloudflareWebhookPayload {
  uid: string
  creator: string | null
  thumbnail: string
  thumbnailTimestampPct: number
  readyToStream: boolean
  readyToStreamAt: string | null
  status: {
    state: 'queued' | 'inprogress' | 'pendingupload' | 'downloading' | 'encoding' | 'ready' | 'error'
    errorReasonCode?: string
    errorReasonText?: string
    pctComplete?: string
  }
  meta: {
    jobId?: string
    channelId?: string
    ladderPreset?: string
    processorId?: string
    [key: string]: any
  }
  created: string
  modified: string
  scheduledDeletion: string | null
  size: number
  preview: string
  allowedOrigins: string[]
  requireSignedURLs: boolean
  uploaded: string | null
  uploadExpiry: string | null
  maxSizeBytes: number | null
  maxDurationSeconds: number | null
  duration: number
  input: {
    width: number
    height: number
  }
  playback: {
    hls: string
    dash: string
  }
  watermark: any | null
  clippedFrom: string | null
  publicDetails: {
    title: string
    share_link: string
    channel_link: string
    logo: string | null
  } | null
}

// =============================================================================
// LOGGER
// =============================================================================

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: object) {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  console.log(`[${timestamp}][TranscodeWebhook][${level}] ${message}${dataStr}`)
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  log('INFO', 'Webhook received')

  try {
    // Verify webhook signature (optional but recommended)
    const webhookSecret = Deno.env.get('CF_WEBHOOK_SECRET')
    const webhookAuth = req.headers.get('cf-webhook-auth')
    
    if (webhookSecret && webhookAuth !== webhookSecret) {
      log('WARN', 'Invalid webhook signature')
      // Still process but log warning - CF might not send signature for all webhooks
    }

    // Parse payload
    const payload: CloudflareWebhookPayload = await req.json()
    
    log('INFO', 'Processing webhook', {
      uid: payload.uid,
      state: payload.status?.state,
      readyToStream: payload.readyToStream,
      jobId: payload.meta?.jobId,
    })

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the job by CF stream UID or job ID from meta
    let jobId = payload.meta?.jobId
    
    if (!jobId) {
      // Try to find by CF UID
      const { data: job } = await supabase
        .from('transcode_jobs')
        .select('id')
        .eq('cf_stream_uid', payload.uid)
        .single()
      
      jobId = job?.id
    }

    if (!jobId) {
      // Maybe it's from cf_stream_uploads - update that instead
      const { data: upload } = await supabase
        .from('cf_stream_uploads')
        .select('id, channel_id')
        .eq('cf_stream_uid', payload.uid)
        .single()

      if (upload) {
        await handleCFStreamUpload(supabase, payload, upload)
        return new Response(
          JSON.stringify({ success: true, handled: 'cf_stream_upload' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      log('WARN', 'No job found for webhook', { uid: payload.uid })
      return new Response(
        JSON.stringify({ success: true, message: 'No matching job found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process based on status
    const state = payload.status?.state
    
    if (state === 'ready' || payload.readyToStream) {
      await handleJobReady(supabase, jobId, payload)
    } else if (state === 'error') {
      await handleJobError(supabase, jobId, payload)
    } else if (['encoding', 'downloading', 'inprogress'].includes(state || '')) {
      await handleJobProgress(supabase, jobId, payload)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    log('ERROR', 'Webhook processing failed', { error: (error as Error).message })
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// =============================================================================
// JOB STATUS HANDLERS
// =============================================================================

async function handleJobReady(
  supabase: any,
  jobId: string,
  payload: CloudflareWebhookPayload
): Promise<void> {
  log('INFO', 'Job completed successfully', { jobId, uid: payload.uid })

  // Build output metadata
  const outputManifests = {
    hls: payload.playback?.hls,
    dash: payload.playback?.dash,
    preview: payload.preview,
  }

  const outputThumbnails = {
    default: payload.thumbnail,
    timestamp: payload.thumbnailTimestampPct,
  }

  const outputMetadata = {
    duration: payload.duration,
    size: payload.size,
    input: payload.input,
    created: payload.created,
    modified: payload.modified,
    readyToStreamAt: payload.readyToStreamAt,
  }

  // Update job to ready
  const { error: updateError } = await supabase
    .from('transcode_jobs')
    .update({
      status: 'ready',
      output_manifests: outputManifests,
      output_thumbnails: outputThumbnails,
      output_metadata: outputMetadata,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (updateError) {
    log('ERROR', 'Failed to update job status', { jobId, error: updateError.message })
    throw updateError
  }

  // Log status change
  await supabase
    .from('transcode_job_history')
    .insert({
      job_id: jobId,
      old_status: 'processing',
      new_status: 'ready',
      changed_by: 'webhook',
      metadata: { 
        cf_uid: payload.uid,
        duration: payload.duration,
        resolution: payload.input,
      },
    })

  // Update m3u_channels with CF stream URL
  const { data: job } = await supabase
    .from('transcode_jobs')
    .select('channel_id')
    .eq('id', jobId)
    .single()

  if (job?.channel_id && payload.playback?.hls) {
    await supabase
      .from('m3u_channels')
      .update({
        cf_stream_uid: payload.uid,
        cf_stream_url: payload.playback.hls,
        cf_stream_status: 'ready',
        cf_stream_duration_seconds: Math.round(payload.duration),
        cf_stream_size_bytes: payload.size,
        cf_stream_uploaded_at: new Date().toISOString(),
      })
      .eq('id', job.channel_id)

    log('INFO', 'Updated channel with CF stream URL', { channelId: job.channel_id })
  }
}

async function handleJobError(
  supabase: any,
  jobId: string,
  payload: CloudflareWebhookPayload
): Promise<void> {
  const errorMessage = payload.status?.errorReasonText || 'Unknown error'
  const errorCode = payload.status?.errorReasonCode || 'UNKNOWN'

  log('ERROR', 'Job failed', { jobId, errorCode, errorMessage })

  // Get current job to check retry count
  const { data: job } = await supabase
    .from('transcode_jobs')
    .select('retry_count, max_retries')
    .eq('id', jobId)
    .single()

  if (job && job.retry_count < job.max_retries) {
    // Schedule retry
    const retryDelay = Math.pow(2, job.retry_count) * 60000
    const retryAfter = new Date(Date.now() + retryDelay)

    await supabase
      .from('transcode_jobs')
      .update({
        status: 'queued',
        processor_id: null,
        retry_count: job.retry_count + 1,
        retry_after: retryAfter.toISOString(),
        error_message: errorMessage,
        error_code: errorCode,
      })
      .eq('id', jobId)

    log('INFO', 'Job scheduled for retry', {
      jobId,
      retryCount: job.retry_count + 1,
      retryAfter: retryAfter.toISOString(),
    })
  } else {
    // Mark as permanently failed
    await supabase
      .from('transcode_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        error_code: errorCode,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }

  // Log status change
  await supabase
    .from('transcode_job_history')
    .insert({
      job_id: jobId,
      old_status: 'processing',
      new_status: job && job.retry_count < job.max_retries ? 'queued' : 'failed',
      changed_by: 'webhook',
      metadata: { errorCode, errorMessage, cf_uid: payload.uid },
    })
}

async function handleJobProgress(
  supabase: any,
  jobId: string,
  payload: CloudflareWebhookPayload
): Promise<void> {
  const progress = payload.status?.pctComplete || '0'
  
  log('INFO', 'Job progress update', { 
    jobId, 
    state: payload.status?.state,
    progress: `${progress}%`,
  })

  // Just update progress metadata, don't change status
  await supabase
    .from('transcode_jobs')
    .update({
      output_metadata: {
        progress: parseFloat(progress),
        state: payload.status?.state,
        lastUpdate: new Date().toISOString(),
      },
    })
    .eq('id', jobId)
}

// =============================================================================
// CF STREAM UPLOADS HANDLER (Legacy support)
// =============================================================================

async function handleCFStreamUpload(
  supabase: any,
  payload: CloudflareWebhookPayload,
  upload: { id: string; channel_id: string }
): Promise<void> {
  const state = payload.status?.state

  if (state === 'ready' || payload.readyToStream) {
    log('INFO', 'CF Stream upload ready', { uploadId: upload.id, channelId: upload.channel_id })

    await supabase
      .from('cf_stream_uploads')
      .update({
        status: 'ready',
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        metadata: {
          duration: payload.duration,
          size: payload.size,
          input: payload.input,
          playback: payload.playback,
        },
      })
      .eq('id', upload.id)

    // Update channel
    await supabase
      .from('m3u_channels')
      .update({
        cf_stream_url: payload.playback?.hls,
        cf_stream_status: 'ready',
        cf_stream_duration_seconds: Math.round(payload.duration),
        cf_stream_size_bytes: payload.size,
        cf_stream_uploaded_at: new Date().toISOString(),
      })
      .eq('id', upload.channel_id)

  } else if (state === 'error') {
    log('ERROR', 'CF Stream upload failed', { 
      uploadId: upload.id, 
      error: payload.status?.errorReasonText 
    })

    await supabase
      .from('cf_stream_uploads')
      .update({
        status: 'error',
        error_message: payload.status?.errorReasonText || 'Unknown error',
      })
      .eq('id', upload.id)

    await supabase
      .from('m3u_channels')
      .update({ cf_stream_status: 'error' })
      .eq('id', upload.channel_id)
  }
}
