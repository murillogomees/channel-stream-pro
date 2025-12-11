/**
 * IPTV Channel Health Webhook
 * 
 * Receives health updates from external probe workers
 * and updates Supabase database accordingly.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

interface HealthUpdate {
  channelId: number;
  isHealthy: boolean;
  healthScore: number;
  probeResult?: {
    codec: string;
    resolution: string;
    bitrate: number;
    frameRate: number;
    latencyMs: number;
  };
  error?: string;
  timestamp: string;
}

interface TranscodeUpdate {
  channelId: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  progress?: number;
  manifestUrl?: string;
  outputUrls?: Array<{
    resolution: string;
    url: string;
  }>;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    // Verify webhook signature
    const signature = req.headers.get('x-webhook-signature');
    const webhookSecret = Deno.env.get('PROBE_WORKER_SECRET');
    
    if (webhookSecret && signature) {
      const body = await req.clone().text();
      const expectedSig = createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSig) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();

    switch (path) {
      case 'health':
        return await handleHealthUpdate(supabase, payload as HealthUpdate);
      
      case 'health-batch':
        return await handleBatchHealthUpdate(supabase, payload as HealthUpdate[]);
      
      case 'transcode':
        return await handleTranscodeUpdate(supabase, payload as TranscodeUpdate);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleHealthUpdate(supabase: any, update: HealthUpdate) {
  const { channelId, isHealthy, healthScore, probeResult, error } = update;

  // Update channel
  const { error: updateError } = await supabase
    .from('iptv_channels')
    .update({
      is_healthy: isHealthy,
      health_score: healthScore,
      last_probe_at: new Date().toISOString(),
      probe_error: error || null,
      codec_hint: probeResult?.codec,
      resolution: probeResult?.resolution,
      bitrate_estimate: probeResult?.bitrate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channelId);

  if (updateError) {
    throw new Error(`Failed to update channel: ${updateError.message}`);
  }

  // Record metric
  if (probeResult?.latencyMs) {
    await supabase
      .from('iptv_channel_metrics')
      .insert({
        channel_id: channelId,
        metric_type: 'probe_latency',
        value: probeResult.latencyMs,
      });
  }

  // Trigger fallback if unhealthy
  if (!isHealthy) {
    const { data: channel } = await supabase
      .from('iptv_channels')
      .select('fallback_channel_id')
      .eq('id', channelId)
      .single();

    if (channel?.fallback_channel_id) {
      console.log(`Channel ${channelId} unhealthy, fallback to ${channel.fallback_channel_id}`);
      // Could trigger notification or auto-switch here
    }
  }

  return new Response(
    JSON.stringify({ success: true, channelId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleBatchHealthUpdate(supabase: any, updates: HealthUpdate[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Process in batches
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    const updatePromises = batch.map(async (update) => {
      try {
        await supabase
          .from('iptv_channels')
          .update({
            is_healthy: update.isHealthy,
            health_score: update.healthScore,
            last_probe_at: update.timestamp,
            probe_error: update.error || null,
            codec_hint: update.probeResult?.codec,
            resolution: update.probeResult?.resolution,
            bitrate_estimate: update.probeResult?.bitrate,
          })
          .eq('id', update.channelId);
        
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Channel ${update.channelId}: ${err.message}`);
      }
    });

    await Promise.all(updatePromises);
  }

  return new Response(
    JSON.stringify(results),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTranscodeUpdate(supabase: any, update: TranscodeUpdate) {
  const { channelId, status, progress, manifestUrl, outputUrls, error } = update;

  // Update channel transcode status
  const { error: updateError } = await supabase
    .from('iptv_channels')
    .update({
      transcode_status: status,
      transcode_manifest_url: manifestUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channelId);

  if (updateError) {
    throw new Error(`Failed to update transcode status: ${updateError.message}`);
  }

  // Update transcode job
  await supabase
    .from('iptv_transcode_jobs')
    .update({
      status,
      progress: progress || 0,
      output_urls: outputUrls ? JSON.stringify(outputUrls) : null,
      error_message: error || null,
      completed_at: status === 'ready' || status === 'failed' ? new Date().toISOString() : null,
    })
    .eq('channel_id', channelId)
    .eq('status', 'processing');

  // If ready, update CDN cache entry
  if (status === 'ready' && manifestUrl) {
    await supabase
      .from('iptv_cdn_cache')
      .upsert({
        channel_id: channelId,
        cdn_provider: 'r2',
        cache_key: `hls/${channelId}`,
        manifest_url: manifestUrl,
        is_warm: true,
        last_access_at: new Date().toISOString(),
      }, {
        onConflict: 'channel_id',
      });
  }

  return new Response(
    JSON.stringify({ success: true, channelId, status }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
