/**
 * CDN Prewarm Service
 * 
 * Nightly job to prefetch first N segments of top predicted assets.
 * Fetches directly from R2 using S3 API to bypass CDN authentication.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFromR2, checkR2Config } from "../_shared/r2-config.ts";

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
      if (trimmed.startsWith('http')) {
        segments.push(trimmed);
      } else {
        const base = new URL(baseUrl);
        const segmentUrl = new URL(trimmed, base).toString();
        segments.push(segmentUrl);
      }
    }
  }
  
  return segments;
}

// Prewarm a single asset by fetching directly from R2
async function prewarmAsset(
  r2Key: string,
  segmentsToFetch: number,
  timeoutMs: number
): Promise<{ success: boolean; segments: number; bytes: number; error?: string }> {
  try {
    // Check R2 config first
    const r2Status = checkR2Config();
    if (!r2Status.configured) {
      return { 
        success: false, 
        segments: 0, 
        bytes: 0, 
        error: `R2 not configured: ${r2Status.missing.join(', ')}` 
      };
    }
    
    const isHlsManifest = r2Key.includes('.m3u8');
    const isMp4 = r2Key.includes('.mp4') || r2Key.includes('/vod/');
    
    if (isHlsManifest) {
      // Fetch manifest from R2
      const manifestData = await getFromR2(r2Key);
      if (!manifestData) {
        return { success: false, segments: 0, bytes: 0, error: 'Manifest not found in R2' };
      }
      
      const manifestContent = new TextDecoder().decode(manifestData.body);
      const segments = parseHlsManifest(manifestContent, r2Key);
      
      let fetchedSegments = 1; // Count manifest itself
      let totalBytes = manifestData.body.length;
      const segmentsToPrewarm = segments.slice(0, segmentsToFetch);
      
      for (const segmentKey of segmentsToPrewarm) {
        try {
          const segmentData = await getFromR2(segmentKey);
          if (segmentData) {
            totalBytes += segmentData.body.length;
            fetchedSegments++;
          }
        } catch (segError) {
          console.warn('[CDN-Prewarm] Segment fetch error:', segError);
        }
      }
      
      return { success: true, segments: fetchedSegments, bytes: totalBytes };
      
    } else if (isMp4) {
      // For MP4/VOD, fetch from R2 directly
      const videoData = await getFromR2(r2Key);
      if (!videoData) {
        return { success: false, segments: 0, bytes: 0, error: 'Video not found in R2' };
      }
      
      // We got the file, prewarm successful (R2 internally warms its cache)
      return { success: true, segments: 1, bytes: videoData.body.length };
      
    } else {
      // For other content, just verify it exists
      const data = await getFromR2(r2Key);
      if (!data) {
        return { success: false, segments: 0, bytes: 0, error: 'Object not found in R2' };
      }
      
      return { success: true, segments: 1, bytes: data.body.length };
    }
    
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
  assets: Array<{ r2_key: string; channel_id: string }>,
  config: PrewarmConfig,
  updateProgress: (prewarmed: number, failed: number, bytes: number) => Promise<void>
): Promise<{ prewarmed: number; failed: number; totalBytes: number; errors: string[] }> {
  let prewarmed = 0;
  let failed = 0;
  let totalBytes = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < assets.length; i += config.concurrency) {
    const batch = assets.slice(i, i + config.concurrency);
    
    const results = await Promise.all(
      batch.map(asset => prewarmAsset(asset.r2_key, config.segmentsPerAsset, config.timeoutMs))
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
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth check
  const authHeader = req.headers.get('authorization');
  const providedSecret = req.headers.get('x-cron-secret');
  
  let isAuthorized = 
    providedSecret === cronSecret ||
    (authHeader && authHeader.includes(supabaseServiceKey));
  
  if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error } = await authSupabase.auth.getUser();
    if (!error && user) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'master');
      if (isAdmin) {
        isAuthorized = true;
        console.log('[CDN-Prewarm] Admin user authorized:', user.email);
      }
    }
  }
  
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

    // Try to recalculate predictions (non-fatal if it fails)
    try {
      const { data: predictionCount, error: predError } = await supabase.rpc('calculate_prewarm_predictions');
      if (predError) {
        console.warn('[CDN-Prewarm] Prediction calculation skipped:', predError.message);
      } else {
        console.log('[CDN-Prewarm] Updated predictions:', predictionCount);
      }
    } catch (rpcError) {
      console.warn('[CDN-Prewarm] RPC not available, continuing without predictions');
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

    let assetsToWarm: Array<{ r2_key: string; channel_id: string }> = [];
    
    if (predictions && predictions.length > 0) {
      // Use predictions that have r2_key
      assetsToWarm = predictions
        .filter(p => p.r2_key)
        .map(p => ({
          r2_key: p.r2_key!,
          channel_id: p.channel_id
        }));
      
      console.log('[CDN-Prewarm] Found predictions with R2 keys:', assetsToWarm.length);
    }
    
    if (assetsToWarm.length === 0) {
      // Fallback to r2_storage_objects
      const { data: fallbackAssets } = await supabase
        .from('r2_storage_objects')
        .select('r2_key, source_channel_id')
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
      
      assetsToWarm = fallbackAssets.map(a => ({
        r2_key: a.r2_key,
        channel_id: a.source_channel_id
      }));
      
      console.log('[CDN-Prewarm] Using fallback assets:', assetsToWarm.length);
    }

    // Create prewarm job record
    const targetKeys = assetsToWarm.map(p => p.r2_key).filter(Boolean);
    const { data: job, error: jobError } = await supabase
      .from('cdn_prewarm_jobs')
      .insert({
        job_type: jobType,
        status: 'running',
        target_r2_keys: targetKeys,
        segments_per_asset: config.segmentsPerAsset,
        total_assets: assetsToWarm.length,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    console.log('[CDN-Prewarm] Starting prewarm for', assetsToWarm.length, 'assets');

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

    // Run prewarm directly from R2
    const result = await processPrewarmQueue(assetsToWarm, config, updateProgress);

    // Finalize job
    const avgTime = assetsToWarm.length > 0 
      ? Math.round((Date.now() - new Date(job.started_at).getTime()) / assetsToWarm.length)
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
        error_log: result.errors.slice(0, 100)
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
