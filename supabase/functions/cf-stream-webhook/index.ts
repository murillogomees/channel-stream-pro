/**
 * Cloudflare Stream Webhook Handler
 * Receives progress notifications from Cloudflare Stream for transcode jobs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (health check)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'CF Stream webhook ready',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('CF Stream webhook received:', payload);

    const { uid, status, meta, readyToStream, thumbnail, preview, duration } = payload;

    // Find job by cf_stream_uid
    const { data: job, error: findError } = await supabase
      .from('transcode_jobs')
      .select('*')
      .eq('cf_stream_uid', uid)
      .single();

    if (findError || !job) {
      console.error('Job not found for uid:', uid);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update job based on Cloudflare Stream status
    const updates: any = {
      thumbnail_url: thumbnail,
      preview_url: preview,
    };

    if (status?.state === 'ready' && readyToStream) {
      updates.status = 'ready';
      updates.completed_at = new Date().toISOString();
      updates.progress_percent = 100;
    } else if (status?.state === 'error') {
      updates.status = 'failed';
      updates.error_message = status?.errorReasonText || 'CF Stream processing error';
      updates.completed_at = new Date().toISOString();
    } else if (status?.state === 'inprogress') {
      updates.status = 'processing';
      updates.progress_percent = parseFloat(status?.pctComplete || '50');
    }

    const { error: updateError } = await supabase
      .from('transcode_jobs')
      .update(updates)
      .eq('id', job.id);

    if (updateError) {
      console.error('Error updating job:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Job updated successfully:', job.id, updates.status);

    return new Response(JSON.stringify({ success: true, jobId: job.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
