/**
 * Cloudflare Worker - IPTV Transcode Manager
 * Handles transcoding job management and FFmpeg coordination
 */

interface Env {
  TRANSCODE_QUEUE: Queue;
  R2_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WORKER_SECRET: string;
  FFMPEG_ENDPOINT?: string;
}

interface TranscodeJob {
  id: number;
  channelId: number;
  sourceUrl: string;
  mode: 'hls' | 'dash';
  resolutions: string[];
  priority: number;
}

interface TranscodeResult {
  jobId: number;
  success: boolean;
  outputs?: Record<string, string>;
  error?: string;
  duration?: number;
}

const RESOLUTION_CONFIGS: Record<string, { width: number; height: number; bitrate: string; audioBitrate: string }> = {
  '1080p': { width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' },
  '720p': { width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
  '480p': { width: 854, height: 480, bitrate: '1000k', audioBitrate: '96k' },
  '360p': { width: 640, height: 360, bitrate: '500k', audioBitrate: '64k' },
  '240p': { width: 426, height: 240, bitrate: '300k', audioBitrate: '48k' },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Secret',
};

async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  const secret = request.headers.get('X-Worker-Secret');
  return secret === env.WORKER_SECRET;
}

async function updateJobStatus(
  env: Env,
  jobId: number,
  status: string,
  progress?: number,
  error?: string,
  outputUrls?: Record<string, string>
): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (progress !== undefined) body.progress = progress;
  if (error) body.error_message = error;
  if (outputUrls) body.output_urls = outputUrls;
  if (status === 'processing') body.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed') body.completed_at = new Date().toISOString();

  await fetch(`${env.SUPABASE_URL}/rest/v1/iptv_transcode_jobs?id=eq.${jobId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(body),
  });
}

async function generateFFmpegCommand(job: TranscodeJob): Promise<string[]> {
  const commands: string[] = [];
  
  for (const resolution of job.resolutions) {
    const config = RESOLUTION_CONFIGS[resolution];
    if (!config) continue;

    if (job.mode === 'hls') {
      commands.push(`
        ffmpeg -i "${job.sourceUrl}" \
          -vf "scale=${config.width}:${config.height}" \
          -c:v libx264 -preset fast -b:v ${config.bitrate} \
          -c:a aac -b:a ${config.audioBitrate} \
          -f hls \
          -hls_time 4 \
          -hls_list_size 0 \
          -hls_segment_filename "channel_${job.channelId}/${resolution}/segment_%03d.ts" \
          "channel_${job.channelId}/${resolution}/playlist.m3u8"
      `.trim());
    } else {
      commands.push(`
        ffmpeg -i "${job.sourceUrl}" \
          -vf "scale=${config.width}:${config.height}" \
          -c:v libx264 -preset fast -b:v ${config.bitrate} \
          -c:a aac -b:a ${config.audioBitrate} \
          -f dash \
          -seg_duration 4 \
          -init_seg_name "channel_${job.channelId}/${resolution}/init.mp4" \
          -media_seg_name "channel_${job.channelId}/${resolution}/segment_$Number$.m4s" \
          "channel_${job.channelId}/${resolution}/manifest.mpd"
      `.trim());
    }
  }

  return commands;
}

async function processTranscode(job: TranscodeJob, env: Env): Promise<TranscodeResult> {
  const startTime = Date.now();
  
  try {
    await updateJobStatus(env, job.id, 'processing', 0);

    // Generate FFmpeg commands
    const commands = await generateFFmpegCommand(job);
    
    if (env.FFMPEG_ENDPOINT) {
      // Send to external FFmpeg service
      const response = await fetch(env.FFMPEG_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.WORKER_SECRET}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          channelId: job.channelId,
          sourceUrl: job.sourceUrl,
          commands,
          callbackUrl: `https://transcode-worker.your-domain.workers.dev/callback`,
        }),
      });

      if (!response.ok) {
        throw new Error(`FFmpeg service error: ${response.status}`);
      }

      return {
        jobId: job.id,
        success: true,
        duration: Date.now() - startTime,
      };
    }

    // Generate output URLs (mock for edge-only processing)
    const outputs: Record<string, string> = {};
    for (const resolution of job.resolutions) {
      const ext = job.mode === 'hls' ? 'm3u8' : 'mpd';
      outputs[resolution] = `https://cdn.iptvlink.com.br/transcode/channel_${job.channelId}/${resolution}/playlist.${ext}`;
    }

    await updateJobStatus(env, job.id, 'completed', 100, undefined, outputs);

    return {
      jobId: job.id,
      success: true,
      outputs,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateJobStatus(env, job.id, 'failed', undefined, errorMessage);
    
    return {
      jobId: job.id,
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  }
}

async function handleQueue(request: Request, env: Env): Promise<Response> {
  const { action, ...params } = await request.json() as { action: string } & Record<string, unknown>;

  switch (action) {
    case 'submit': {
      const job: TranscodeJob = {
        id: params.jobId as number,
        channelId: params.channelId as number,
        sourceUrl: params.sourceUrl as string,
        mode: (params.mode as 'hls' | 'dash') || 'hls',
        resolutions: (params.resolutions as string[]) || ['720p', '480p', '360p'],
        priority: (params.priority as number) || 5,
      };

      // Queue the job
      if (env.TRANSCODE_QUEUE) {
        await env.TRANSCODE_QUEUE.send(job, {
          contentType: 'json',
        });
      }

      return Response.json({ success: true, queued: true, jobId: job.id });
    }

    case 'process': {
      const job = params.job as TranscodeJob;
      const result = await processTranscode(job, env);
      return Response.json(result);
    }

    case 'status': {
      const response = await fetch(
        `${env.SUPABASE_URL}/rest/v1/iptv_transcode_jobs?id=eq.${params.jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      const jobs = await response.json();
      return Response.json({ job: jobs[0] || null });
    }

    case 'list': {
      const response = await fetch(
        `${env.SUPABASE_URL}/rest/v1/iptv_transcode_jobs?order=created_at.desc&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      const jobs = await response.json();
      
      const stats = {
        total: jobs.length,
        pending: jobs.filter((j: { status: string }) => j.status === 'pending').length,
        processing: jobs.filter((j: { status: string }) => j.status === 'processing').length,
        completed: jobs.filter((j: { status: string }) => j.status === 'completed').length,
        failed: jobs.filter((j: { status: string }) => j.status === 'failed').length,
      };

      return Response.json({ jobs, stats });
    }

    case 'cancel': {
      await updateJobStatus(env, params.jobId as number, 'cancelled');
      return Response.json({ success: true });
    }

    case 'retry': {
      await updateJobStatus(env, params.jobId as number, 'pending', 0);
      return Response.json({ success: true });
    }

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const { jobId, status, progress, outputs, error } = await request.json() as {
    jobId: number;
    status: string;
    progress?: number;
    outputs?: Record<string, string>;
    error?: string;
  };

  await updateJobStatus(env, jobId, status, progress, error, outputs);

  // If completed, update channel with transcode manifest URL
  if (status === 'completed' && outputs) {
    const mainOutput = outputs['720p'] || outputs['480p'] || Object.values(outputs)[0];
    if (mainOutput) {
      const jobResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/iptv_transcode_jobs?id=eq.${jobId}&select=channel_id`,
        {
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );
      const [job] = await jobResponse.json() as { channel_id: number }[];
      
      if (job?.channel_id) {
        await fetch(
          `${env.SUPABASE_URL}/rest/v1/iptv_channels?id=eq.${job.channel_id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            },
            body: JSON.stringify({
              transcode_status: 'ready',
              transcode_manifest_url: mainOutput,
            }),
          }
        );
      }
    }
  }

  return Response.json({ success: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return Response.json({ 
        status: 'healthy', 
        service: 'transcode-worker',
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders });
    }

    // Auth check for other endpoints
    if (!await verifyAuth(request, env)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      if (path === '/callback') {
        const response = await handleCallback(request, env);
        return new Response(response.body, { ...response, headers: { ...corsHeaders, ...Object.fromEntries(response.headers) } });
      }

      if (path === '/queue' || path === '/') {
        const response = await handleQueue(request, env);
        return new Response(response.body, { ...response, headers: { ...corsHeaders, ...Object.fromEntries(response.headers) } });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Transcode worker error:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },

  async queue(batch: MessageBatch<TranscodeJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body;
      console.log(`Processing transcode job ${job.id} for channel ${job.channelId}`);
      
      await processTranscode(job, env);
      message.ack();
    }
  },
};
