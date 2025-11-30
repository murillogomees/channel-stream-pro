/**
 * CDN Prewarm Service
 * 
 * Nightly job to prefetch first N segments of top predicted assets.
 * Uses ML predictions if available, falls back to moving average of views.
 * 
 * Prewarm pattern:
 * 1. Get top predicted assets from cdn_prewarm_predictions
 * 2. For each asset, fetch manifest and first N segments
 * 3. Segments are fetched through CDN to populate edge cache
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrewarmConfig {
  maxAssets: number;
  segmentsPerAsset: number;
  concurrency: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: PrewarmConfig = {
  maxAssets: 100,
  segmentsPerAsset: 5,
  concurrency: 10,
  timeoutMs: 30000
};

// Parse HLS manifest to extract segment URLs
function parseHlsManifest(content: string, baseUrl: string): string[] {
  const segments: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      // This is a segment URL
      if (trimmed.startsWith('http')) {
        segments.push(trimmed);
      } else {
        // Relative URL - resolve against base
        const base = new URL(baseUrl);
        const segmentUrl = new URL(trimmed, base).toString();
        segments.push(segmentUrl);
      }
    }
  }
  
  return segments;
}

// Prewarm a single asset
async function prewarmAsset(
  cdnUrl: string,
  segmentsToFetch: number,
  timeoutMs: number
): Promise<{ success: boolean; segments: number; bytes: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    // Fetch manifest
    const manifestResponse = await fetch(cdnUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CDN-Prewarm-Bot/1.0',
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
      }
    });
    
    if (!manifestResponse.ok) {
      clearTimeout(timeout);
      return { success: false, segments: 0, bytes: 0, error: `Manifest fetch failed: ${manifestResponse.status}` };
    }
    
    const manifestContent = await manifestResponse.text();
    const segments = parseHlsManifest(manifestContent, cdnUrl);
    
    // Fetch first N segments
    let fetchedSegments = 0;
    let totalBytes = 0;
    const segmentsToPrewarm = segments.slice(0, segmentsToFetch);
    
    for (const segmentUrl of segmentsToPrewarm) {
      try {
        // Strip JWT from segment URL to normalize cache key
        const normalizedUrl = segmentUrl.split('?')[0];
        
        const segmentResponse = await fetch(normalizedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'CDN-Prewarm-Bot/1.0',
            'Accept': 'video/mp2t, application/octet-stream, */*'
          }
        });
        
        if (segmentResponse.ok) {
          const body = await segmentResponse.arrayBuffer();
          totalBytes += body.byteLength;
          fetchedSegments++;
        }
      } catch (segError) {
        // Continue with other segments
        console.warn('[CDN-Prewarm] Segment fetch error:', segError);
      }
    }
    
    clearTimeout(timeout);
    return { success: true, segments: fetchedSegments, bytes: totalBytes };
    
  } catch (error) {
    return { 
      success: false, 
      segments: 0, 
      bytes: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Process prewarm queue with concurrency control
async function processPrewarmQueue(
  assets: Array<{ r2_key: string; cdn_url: string; channel_id: string }>,
  config: PrewarmConfig,
  updateProgress: (prewarmed: number, failed: number, bytes: number) => Promise<void>
): Promise<{ prewarmed: number; failed: number; totalBytes: number; errors: string[] }> {
  let prewarmed = 0;
  let failed = 0;
  let totalBytes = 0;
  const errors: string[] = [];
  
  // Process in batches for concurrency control
  for (let i = 0; i < assets.length; i += config.concurrency) {
    const batch = assets.slice(i, i + config.concurrency);
    
    const results = await Promise.all(
      batch.map(asset => prewarmAsset(asset.cdn_url, config.segmentsPerAsset, config.timeoutMs))
    );
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.success) {
        prewarmed++;
        totalBytes += result.bytes;
      } else {
        failed++;
        if (result.error) {
          errors.push(`${batch[j].r2_key}: ${result.error}`);
        }
      }
    }
    
    // Update progress
    await updateProgress(prewarmed, failed, totalBytes);
  }
  
  return { prewarmed, failed, totalBytes, errors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');
  const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN') || 'cdn.example.com';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth check for cron jobs
  const authHeader = req.headers.get('authorization');
  const providedSecret = req.headers.get('x-cron-secret');
  
  const isAuthorized = 
    providedSecret === cronSecret ||
    (authHeader && authHeader.includes(supabaseServiceKey));
  
  if (!isAuthorized) {
    console.log('[CDN-Prewarm] Unauthorized request');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const jobType = url.searchParams.get('type') || 'nightly';
    const maxAssets = parseInt(url.searchParams.get('max') || '100');
    const segmentsPerAsset = parseInt(url.searchParams.get('segments') || '5');
    
    const config: PrewarmConfig = {
      ...DEFAULT_CONFIG,
      maxAssets,
      segmentsPerAsset
    };

    console.log('[CDN-Prewarm] Starting prewarm job', { jobType, config });

    // First, recalculate predictions
    const { data: predictionCount, error: predError } = await supabase.rpc('calculate_prewarm_predictions');
    if (predError) {
      console.error('[CDN-Prewarm] Prediction calculation error:', predError);
    } else {
      console.log('[CDN-Prewarm] Updated predictions:', predictionCount);
    }

    // Get top predicted assets
    const { data: predictions, error: fetchError } = await supabase
      .from('cdn_prewarm_predictions')
      .select(`
        channel_id,
        r2_key,
        predicted_views,
        moving_avg_views,
        ml_score,
        priority_rank
      `)
      .not('r2_key', 'is', null)
      .order('priority_rank', { ascending: true })
      .limit(config.maxAssets);

    if (fetchError) {
      throw new Error(`Failed to fetch predictions: ${fetchError.message}`);
    }

    if (!predictions || predictions.length === 0) {
      // Fallback: get R2 objects with highest access count
      const { data: fallbackAssets } = await supabase
        .from('r2_storage_objects')
        .select('r2_key, source_channel_id, cdn_url')
        .eq('status', 'ready')
        .in('content_type', ['vod', 'manifest'])
        .order('access_count', { ascending: false })
        .limit(config.maxAssets);
      
      if (!fallbackAssets || fallbackAssets.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No assets to prewarm',
            prewarmed: 0,
            failed: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Use fallback assets
      predictions.push(...fallbackAssets.map(a => ({
        channel_id: a.source_channel_id,
        r2_key: a.r2_key,
        cdn_url: a.cdn_url,
        predicted_views: 0,
        moving_avg_views: 0,
        ml_score: null,
        priority_rank: 0
      })));
    }

    // Create prewarm job record
    const targetKeys = predictions.map(p => p.r2_key).filter(Boolean);
    const { data: job, error: jobError } = await supabase
      .from('cdn_prewarm_jobs')
      .insert({
        job_type: jobType,
        status: 'running',
        target_r2_keys: targetKeys,
        segments_per_asset: config.segmentsPerAsset,
        total_assets: predictions.length,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Prepare assets for prewarming
    const assets = predictions
      .filter(p => p.r2_key)
      .map(p => ({
        r2_key: p.r2_key!,
        cdn_url: `https://${r2Domain}/${p.r2_key}`,
        channel_id: p.channel_id
      }));

    // Progress update function
    const updateProgress = async (prewarmed: number, failed: number, bytes: number) => {
      await supabase
        .from('cdn_prewarm_jobs')
        .update({
          prewarmed_assets: prewarmed,
          failed_assets: failed,
          total_bytes_prewarmed: bytes
        })
        .eq('id', job.id);
    };

    // Run prewarm
    const result = await processPrewarmQueue(assets, config, updateProgress);

    // Finalize job
    const avgTime = assets.length > 0 
      ? Math.round((Date.now() - new Date(job.started_at).getTime()) / assets.length)
      : 0;

    await supabase
      .from('cdn_prewarm_jobs')
      .update({
        status: result.failed > result.prewarmed ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        prewarmed_assets: result.prewarmed,
        failed_assets: result.failed,
        total_bytes_prewarmed: result.totalBytes,
        avg_prewarm_time_ms: avgTime,
        error_log: result.errors.slice(0, 100) // Keep first 100 errors
      })
      .eq('id', job.id);

    console.log('[CDN-Prewarm] Job completed', {
      jobId: job.id,
      prewarmed: result.prewarmed,
      failed: result.failed,
      totalBytes: result.totalBytes
    });

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        prewarmed: result.prewarmed,
        failed: result.failed,
        total_bytes: result.totalBytes,
        avg_prewarm_time_ms: avgTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CDN-Prewarm] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
