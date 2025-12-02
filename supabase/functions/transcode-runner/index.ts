import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscodeJob {
  id: string;
  input_url: string;
  output_format: string;
  resolution: string;
  bitrate?: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending transcode jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('transcode_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processedJobs = [];

    for (const job of jobs) {
      try {
        console.log(`Processing transcode job ${job.id}...`);

        // Update status to processing
        await supabase
          .from('transcode_jobs')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Simulate transcode (in production, this would call FFmpeg/Cloudflare Stream API)
        // For now, we'll just simulate the process
        const outputUrl = `https://r2.iptvlink.com/transcoded/${job.id}.${job.output_format}`;

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update job as completed
        await supabase
          .from('transcode_jobs')
          .update({
            status: 'completed',
            output_url: outputUrl,
            completed_at: new Date().toISOString(),
            metadata: {
              resolution: job.resolution,
              format: job.output_format,
              bitrate: job.bitrate,
            },
          })
          .eq('id', job.id);

        processedJobs.push({
          job_id: job.id,
          status: 'completed',
          output_url: outputUrl,
        });

        console.log(`Job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);

        // Update job as failed
        await supabase
          .from('transcode_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        processedJobs.push({
          job_id: job.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedJobs.length,
        jobs: processedJobs,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Transcode runner error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
