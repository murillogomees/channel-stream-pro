import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscodeRequest {
  action: 'create' | 'cancel' | 'retry' | 'status' | 'list' | 'callback';
  jobId?: number;
  channelId?: number;
  mode?: 'hls' | 'dash';
  resolutions?: string[];
  callbackData?: {
    status: string;
    progress: number;
    outputUrls?: Record<string, string>;
    error?: string;
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

    const body: TranscodeRequest = await req.json();
    console.log('[iptv-transcode] Request:', body.action);

    switch (body.action) {
      case 'create': {
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

        // Create transcode job
        const { data: job, error: jobError } = await supabase
          .from('iptv_transcode_jobs')
          .insert({
            channel_id: body.channelId,
            status: 'pending',
            mode: body.mode || 'hls',
            target_resolutions: body.resolutions || ['720p', '480p', '360p'],
            progress: 0,
          })
          .select()
          .single();

        if (jobError) throw jobError;

        console.log('[iptv-transcode] Created job:', job.id);

        // Notify external transcoder worker (if configured)
        const transcoderUrl = Deno.env.get('TRANSCODER_WORKER_URL');
        if (transcoderUrl) {
          const transcoderSecret = Deno.env.get('TRANSCODE_CALLBACK_SECRET');
          try {
            await fetch(transcoderUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${transcoderSecret}`,
              },
              body: JSON.stringify({
                jobId: job.id,
                channelId: channel.id,
                sourceUrl: channel.original_url,
                mode: body.mode || 'hls',
                resolutions: body.resolutions || ['720p', '480p', '360p'],
                callbackUrl: `${supabaseUrl}/functions/v1/iptv-transcode`,
              }),
            });
            console.log('[iptv-transcode] Notified external transcoder');
          } catch (e) {
            console.warn('[iptv-transcode] Failed to notify transcoder:', e);
          }
        }

        return new Response(JSON.stringify({ success: true, job }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'cancel': {
        if (!body.jobId) {
          return new Response(JSON.stringify({ error: 'jobId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('iptv_transcode_jobs')
          .update({ status: 'cancelled' })
          .eq('id', body.jobId)
          .in('status', ['pending', 'processing']);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'retry': {
        if (!body.jobId) {
          return new Response(JSON.stringify({ error: 'jobId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('iptv_transcode_jobs')
          .update({ 
            status: 'pending', 
            progress: 0, 
            error_message: null,
            started_at: null,
            completed_at: null 
          })
          .eq('id', body.jobId)
          .eq('status', 'failed');

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
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
          .from('iptv_transcode_jobs')
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
          .from('iptv_transcode_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const stats = {
          total: jobs.length,
          pending: jobs.filter(j => j.status === 'pending').length,
          processing: jobs.filter(j => j.status === 'processing').length,
          completed: jobs.filter(j => j.status === 'completed').length,
          failed: jobs.filter(j => j.status === 'failed').length,
        };

        return new Response(JSON.stringify({ jobs, stats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'callback': {
        // Callback from external transcoder
        const callbackSecret = Deno.env.get('TRANSCODE_CALLBACK_SECRET');
        const authHeader = req.headers.get('authorization');
        
        if (callbackSecret && authHeader !== `Bearer ${callbackSecret}`) {
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

        const updateData: Record<string, unknown> = {
          status: body.callbackData.status,
          progress: body.callbackData.progress,
        };

        if (body.callbackData.status === 'processing' && !body.callbackData.error) {
          updateData.started_at = new Date().toISOString();
        }

        if (body.callbackData.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
          updateData.output_urls = body.callbackData.outputUrls;

          // Update channel with transcode manifest URL
          const { data: job } = await supabase
            .from('iptv_transcode_jobs')
            .select('channel_id')
            .eq('id', body.jobId)
            .single();

          if (job && body.callbackData.outputUrls?.master) {
            await supabase
              .from('iptv_channels')
              .update({
                transcode_status: 'ready',
                transcode_manifest_url: body.callbackData.outputUrls.master,
              })
              .eq('id', job.channel_id);
          }
        }

        if (body.callbackData.status === 'failed') {
          updateData.error_message = body.callbackData.error;
          updateData.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from('iptv_transcode_jobs')
          .update(updateData)
          .eq('id', body.jobId);

        if (error) throw error;

        console.log('[iptv-transcode] Callback processed for job:', body.jobId);

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
    console.error('[iptv-transcode] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});