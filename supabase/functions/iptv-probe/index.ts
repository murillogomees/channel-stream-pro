import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProbeRequest {
  action: 'probe' | 'batch-probe' | 'status' | 'list' | 'callback';
  channelId?: number;
  channelIds?: number[];
  jobId?: number;
  callbackData?: {
    status: string;
    result?: {
      resolution?: string;
      bitrate?: number;
      codec?: string;
      isHealthy?: boolean;
      error?: string;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ProbeRequest = await req.json();
    console.log('[iptv-probe] Request:', body.action);

    switch (body.action) {
      case 'probe': {
        if (!body.channelId) {
          return new Response(JSON.stringify({ error: 'channelId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get channel info
        const { data: channel, error: channelError } = await supabase
          .from('iptv_channels')
          .select('id, name, original_url')
          .eq('id', body.channelId)
          .single();

        if (channelError || !channel) {
          return new Response(JSON.stringify({ error: 'Channel not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create probe job
        const { data: job, error: jobError } = await supabase
          .from('iptv_probe_jobs')
          .insert({
            channel_id: body.channelId,
            status: 'pending',
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Simple probe: try to fetch the URL and check if it's accessible
        let probeResult = {
          isHealthy: false,
          error: null as string | null,
          resolution: null as string | null,
          bitrate: null as number | null,
          codec: null as string | null,
        };

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(channel.original_url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            },
          });

          clearTimeout(timeout);

          probeResult.isHealthy = response.ok;
          
          // Check content type for hints
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('mpegurl') || contentType.includes('x-mpegurl')) {
            probeResult.codec = 'HLS';
          } else if (contentType.includes('mp2t') || contentType.includes('mpeg')) {
            probeResult.codec = 'MPEG-TS';
          }

          // Try to get content length as bitrate hint
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            probeResult.bitrate = parseInt(contentLength);
          }
        } catch (e) {
          probeResult.isHealthy = false;
          probeResult.error = e.message;
        }

        // Update probe job with result
        await supabase
          .from('iptv_probe_jobs')
          .update({
            status: probeResult.isHealthy ? 'completed' : 'failed',
            result: probeResult,
            completed_at: new Date().toISOString(),
            error_message: probeResult.error,
          })
          .eq('id', job.id);

        // Update channel health
        await supabase
          .from('iptv_channels')
          .update({
            is_healthy: probeResult.isHealthy,
            health_score: probeResult.isHealthy ? 100 : 0,
            last_probe_at: new Date().toISOString(),
            probe_error: probeResult.error,
            resolution: probeResult.resolution,
            codec_hint: probeResult.codec,
            bitrate_estimate: probeResult.bitrate,
          })
          .eq('id', body.channelId);

        console.log('[iptv-probe] Probe completed for channel:', body.channelId, 'healthy:', probeResult.isHealthy);

        return new Response(JSON.stringify({ 
          success: true, 
          job: { ...job, status: probeResult.isHealthy ? 'completed' : 'failed' },
          result: probeResult
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'batch-probe': {
        if (!body.channelIds || body.channelIds.length === 0) {
          return new Response(JSON.stringify({ error: 'channelIds required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const results: { channelId: number; healthy: boolean; error?: string }[] = [];

        // Probe channels in batches
        for (const channelId of body.channelIds.slice(0, 50)) {
          const { data: channel } = await supabase
            .from('iptv_channels')
            .select('id, original_url')
            .eq('id', channelId)
            .single();

          if (!channel) {
            results.push({ channelId, healthy: false, error: 'Not found' });
            continue;
          }

          let healthy = false;
          let error: string | undefined;

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(channel.original_url, {
              method: 'HEAD',
              signal: controller.signal,
              headers: { 'User-Agent': 'VLC/3.0.18' },
            });

            clearTimeout(timeout);
            healthy = response.ok;
          } catch (e) {
            error = e.message;
          }

          // Update channel
          await supabase
            .from('iptv_channels')
            .update({
              is_healthy: healthy,
              health_score: healthy ? 100 : 0,
              last_probe_at: new Date().toISOString(),
              probe_error: error || null,
            })
            .eq('id', channelId);

          results.push({ channelId, healthy, error });
        }

        console.log('[iptv-probe] Batch probe completed:', results.length, 'channels');

        return new Response(JSON.stringify({ 
          success: true, 
          results,
          summary: {
            total: results.length,
            healthy: results.filter(r => r.healthy).length,
            unhealthy: results.filter(r => !r.healthy).length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'status': {
        if (!body.jobId) {
          return new Response(JSON.stringify({ error: 'jobId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: job, error } = await supabase
          .from('iptv_probe_jobs')
          .select('*')
          .eq('id', body.jobId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ job }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'list': {
        const { data: jobs, error } = await supabase
          .from('iptv_probe_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        return new Response(JSON.stringify({ jobs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'callback': {
        // Callback from external probe worker
        const probeSecret = Deno.env.get('PROBE_WORKER_SECRET');
        const authHeader = req.headers.get('authorization');
        
        if (probeSecret && authHeader !== `Bearer ${probeSecret}`) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!body.jobId || !body.callbackData) {
          return new Response(JSON.stringify({ error: 'jobId and callbackData required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get job to find channel
        const { data: job } = await supabase
          .from('iptv_probe_jobs')
          .select('channel_id')
          .eq('id', body.jobId)
          .single();

        if (!job) {
          return new Response(JSON.stringify({ error: 'Job not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update probe job
        await supabase
          .from('iptv_probe_jobs')
          .update({
            status: body.callbackData.status,
            result: body.callbackData.result,
            completed_at: new Date().toISOString(),
            error_message: body.callbackData.result?.error,
          })
          .eq('id', body.jobId);

        // Update channel health
        if (body.callbackData.result) {
          await supabase
            .from('iptv_channels')
            .update({
              is_healthy: body.callbackData.result.isHealthy,
              health_score: body.callbackData.result.isHealthy ? 100 : 0,
              last_probe_at: new Date().toISOString(),
              probe_error: body.callbackData.result.error,
              resolution: body.callbackData.result.resolution,
              bitrate_estimate: body.callbackData.result.bitrate,
              codec_hint: body.callbackData.result.codec,
            })
            .eq('id', job.channel_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('[iptv-probe] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});