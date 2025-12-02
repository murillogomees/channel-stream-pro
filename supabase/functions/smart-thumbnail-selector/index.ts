/**
 * Smart Thumbnail Selector using AI
 * Uses Lovable AI to analyze video frames and select best thumbnail
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
    const { jobId, frameUrls } = await req.json();

    if (!jobId || !frameUrls || frameUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'jobId and frameUrls required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`[SmartThumbnail] Analyzing ${frameUrls.length} frames for job ${jobId}`);

    // Call Lovable AI to analyze frames
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at selecting the best video thumbnail. Analyze frames and identify which has: clear subject, good composition, high visual interest, faces (if present) are in-focus, vibrant colors, and represents video content well.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze these ${frameUrls.length} video frames and recommend which frame number (1-${frameUrls.length}) would make the BEST thumbnail. Return ONLY the frame number.`,
              },
              ...frameUrls.map((url: string) => ({
                type: 'image_url',
                image_url: { url },
              })),
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI analysis failed: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const recommendation = aiData.choices?.[0]?.message?.content || '1';
    const bestFrameIndex = parseInt(recommendation.match(/\d+/)?.[0] || '1') - 1;
    const bestFrameUrl = frameUrls[Math.min(bestFrameIndex, frameUrls.length - 1)];

    console.log(`[SmartThumbnail] AI selected frame ${bestFrameIndex + 1}/${frameUrls.length}`);

    // Update job with selected thumbnail
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: updateError } = await supabase
      .from('transcode_jobs')
      .update({
        thumbnail_url: bestFrameUrl,
        ai_selected_thumbnail: true,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[SmartThumbnail] Error updating job:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        selectedFrame: bestFrameIndex + 1,
        thumbnailUrl: bestFrameUrl,
        totalFrames: frameUrls.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SmartThumbnail] Error:', error);
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
