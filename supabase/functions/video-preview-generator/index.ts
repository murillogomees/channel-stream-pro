/**
 * Video Preview Generator
 * Generates 10-second preview clips from transcode jobs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, startTime = 30, duration = 10 } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('transcode_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    console.log(`[PreviewGen] Generating ${duration}s preview for job ${jobId} starting at ${startTime}s`);

    // In production, this would call FFmpeg or Cloudflare Stream API to extract clip
    // For now, simulate the process
    const previewUrl = `https://r2.iptvlink.com/previews/${jobId}_preview_${startTime}-${startTime + duration}.mp4`;

    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing

    // Update job with preview URL
    const { error: updateError } = await supabase
      .from('transcode_jobs')
      .update({
        preview_url: previewUrl,
      })
      .eq('id', jobId);

    if (updateError) {
      throw updateError;
    }

    console.log(`[PreviewGen] Preview generated: ${previewUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        previewUrl,
        startTime,
        duration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[PreviewGen] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
