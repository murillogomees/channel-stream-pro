import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * IPTV Performance Optimizer Edge Function
 * Handles CDN routing, load balancing, and performance monitoring
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PerformanceMetrics {
  latency: number;
  bandwidth: number;
  bufferHealth: number;
  errorRate: number;
  timestamp: string;
}

interface CDNNode {
  id: string;
  url: string;
  region: string;
  weight: number;
  healthy: boolean;
  avgLatency: number;
  load: number;
}

interface OptimizationResult {
  recommendedCDN: string;
  recommendedQuality: string;
  bufferSize: number;
  preloadSegments: number;
  adaptiveSettings: {
    minBitrate: number;
    maxBitrate: number;
    startLevel: number;
  };
}

// CDN nodes configuration
const CDN_NODES: CDNNode[] = [
  { id: 'cf-primary', url: 'https://cdn.iptvlink.com.br', region: 'global', weight: 100, healthy: true, avgLatency: 0, load: 0 },
  { id: 'r2-storage', url: 'https://r2.iptvlink.com.br', region: 'global', weight: 80, healthy: true, avgLatency: 0, load: 0 },
  { id: 'stream-cf', url: 'https://stream.iptvlink.com.br', region: 'global', weight: 90, healthy: true, avgLatency: 0, load: 0 },
];

// Quality presets based on bandwidth
const QUALITY_PRESETS = {
  '4k': { minBandwidth: 25000, bitrate: 15000, resolution: '3840x2160' },
  '1080p': { minBandwidth: 8000, bitrate: 5000, resolution: '1920x1080' },
  '720p': { minBandwidth: 4000, bitrate: 2500, resolution: '1280x720' },
  '480p': { minBandwidth: 2000, bitrate: 1000, resolution: '854x480' },
  '360p': { minBandwidth: 1000, bitrate: 500, resolution: '640x360' },
  '240p': { minBandwidth: 500, bitrate: 300, resolution: '426x240' },
};

function selectOptimalQuality(bandwidth: number): string {
  const qualities = Object.entries(QUALITY_PRESETS)
    .sort((a, b) => b[1].minBandwidth - a[1].minBandwidth);
  
  for (const [quality, preset] of qualities) {
    if (bandwidth >= preset.minBandwidth) {
      return quality;
    }
  }
  return '240p';
}

function calculateBufferSize(bandwidth: number, latency: number): number {
  // Base buffer: 30 seconds
  // Adjust based on network conditions
  const baseBuffer = 30;
  const latencyFactor = Math.min(2, latency / 100);
  const bandwidthFactor = bandwidth < 2000 ? 1.5 : 1;
  
  return Math.round(baseBuffer * latencyFactor * bandwidthFactor);
}

function calculatePreloadSegments(bandwidth: number, deviceType: string): number {
  const base = deviceType === 'mobile' ? 2 : 3;
  const bandwidthFactor = bandwidth > 5000 ? 2 : 1;
  return base * bandwidthFactor;
}

async function getOptimalCDN(
  supabase: ReturnType<typeof createClient>,
  userRegion?: string
): Promise<CDNNode> {
  // Get latest CDN health metrics
  const { data: metrics } = await supabase
    .from('iptv_cdn_cache')
    .select('cdn_provider, is_warm')
    .order('last_access_at', { ascending: false })
    .limit(100);

  // Calculate CDN loads
  const cdnLoads: Record<string, number> = {};
  if (metrics) {
    for (const m of metrics) {
      const provider = m.cdn_provider || 'cf-primary';
      cdnLoads[provider] = (cdnLoads[provider] || 0) + 1;
    }
  }

  // Find healthiest, least loaded CDN
  const availableNodes = CDN_NODES.filter(n => n.healthy);
  
  if (availableNodes.length === 0) {
    return CDN_NODES[0]; // Fallback to primary
  }

  // Sort by weighted score (lower load + higher weight = better)
  availableNodes.sort((a, b) => {
    const aLoad = cdnLoads[a.id] || 0;
    const bLoad = cdnLoads[b.id] || 0;
    const aScore = (aLoad / 100) - (a.weight / 100);
    const bScore = (bLoad / 100) - (b.weight / 100);
    return aScore - bScore;
  });

  return availableNodes[0];
}

async function handleOptimize(
  supabase: ReturnType<typeof createClient>,
  params: {
    bandwidth?: number;
    latency?: number;
    deviceType?: string;
    userRegion?: string;
    channelId?: number;
  }
): Promise<Response> {
  const {
    bandwidth = 5000,
    latency = 50,
    deviceType = 'desktop',
    userRegion,
    channelId,
  } = params;

  console.log('[iptv-performance] Optimizing for:', { bandwidth, latency, deviceType });

  const optimalCDN = await getOptimalCDN(supabase, userRegion);
  const quality = selectOptimalQuality(bandwidth);
  const bufferSize = calculateBufferSize(bandwidth, latency);
  const preloadSegments = calculatePreloadSegments(bandwidth, deviceType);
  const qualityPreset = QUALITY_PRESETS[quality as keyof typeof QUALITY_PRESETS];

  const result: OptimizationResult = {
    recommendedCDN: optimalCDN.url,
    recommendedQuality: quality,
    bufferSize,
    preloadSegments,
    adaptiveSettings: {
      minBitrate: QUALITY_PRESETS['240p'].bitrate,
      maxBitrate: qualityPreset.bitrate,
      startLevel: Object.keys(QUALITY_PRESETS).indexOf(quality),
    },
  };

  // Store optimization decision for analytics
  if (channelId) {
    await supabase.from('iptv_channel_metrics').insert({
      channel_id: channelId,
      metric_type: 'optimization',
      value: bandwidth,
    });
  }

  return new Response(JSON.stringify({ success: true, optimization: result }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleHealthCheck(
  supabase: ReturnType<typeof createClient>,
  params: { urls: string[] }
): Promise<Response> {
  const results: Array<{ url: string; healthy: boolean; latency: number; error?: string }> = [];

  for (const url of params.urls) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      results.push({
        url,
        healthy: response.ok,
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        url,
        healthy: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const healthyCount = results.filter(r => r.healthy).length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

  return new Response(JSON.stringify({
    success: true,
    results,
    summary: {
      total: results.length,
      healthy: healthyCount,
      unhealthy: results.length - healthyCount,
      avgLatency: Math.round(avgLatency),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleMetrics(
  supabase: ReturnType<typeof createClient>,
  params: {
    channelId?: number;
    metrics: PerformanceMetrics;
    sessionId?: string;
  }
): Promise<Response> {
  const { channelId, metrics, sessionId } = params;

  console.log('[iptv-performance] Recording metrics:', { channelId, sessionId });

  // Store metrics
  if (channelId) {
    await supabase.from('iptv_channel_metrics').insert([
      { channel_id: channelId, metric_type: 'latency', value: metrics.latency },
      { channel_id: channelId, metric_type: 'bandwidth', value: metrics.bandwidth },
      { channel_id: channelId, metric_type: 'buffer_health', value: metrics.bufferHealth },
      { channel_id: channelId, metric_type: 'error_rate', value: metrics.errorRate },
    ]);
  }

  // Analyze and return recommendations
  const recommendations: string[] = [];
  
  if (metrics.latency > 200) {
    recommendations.push('Consider switching to a closer CDN region');
  }
  if (metrics.bufferHealth < 50) {
    recommendations.push('Increase buffer size or reduce quality');
  }
  if (metrics.errorRate > 5) {
    recommendations.push('Check stream source health');
  }
  if (metrics.bandwidth < 2000) {
    recommendations.push('Switch to lower quality preset');
  }

  return new Response(JSON.stringify({
    success: true,
    recorded: true,
    recommendations,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleLoadBalance(
  supabase: ReturnType<typeof createClient>,
  params: { channelIds: number[] }
): Promise<Response> {
  const { channelIds } = params;

  // Get channel info
  const { data: channels } = await supabase
    .from('iptv_channels')
    .select('id, name, original_url, health_score, transcode_manifest_url')
    .in('id', channelIds);

  if (!channels?.length) {
    return new Response(JSON.stringify({ error: 'No channels found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Distribute channels across CDNs
  const distribution: Record<string, number[]> = {};
  
  for (let i = 0; i < channels.length; i++) {
    const cdn = CDN_NODES[i % CDN_NODES.length];
    if (!distribution[cdn.id]) {
      distribution[cdn.id] = [];
    }
    distribution[cdn.id].push(channels[i].id);
  }

  return new Response(JSON.stringify({
    success: true,
    distribution,
    cdnNodes: CDN_NODES.map(n => ({ id: n.id, url: n.url, region: n.region })),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handlePrewarm(
  supabase: ReturnType<typeof createClient>,
  params: { channelIds: number[]; ttl?: number }
): Promise<Response> {
  const { channelIds, ttl = 3600 } = params;

  console.log('[iptv-performance] Pre-warming cache for channels:', channelIds);

  // Get channel URLs
  const { data: channels } = await supabase
    .from('iptv_channels')
    .select('id, name, original_url, logo_url, transcode_manifest_url')
    .in('id', channelIds);

  if (!channels?.length) {
    return new Response(JSON.stringify({ error: 'No channels found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const warmed: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  for (const channel of channels) {
    try {
      // Record cache warmup
      await supabase.from('iptv_cdn_cache').upsert({
        channel_id: channel.id,
        cache_key: `channel_${channel.id}`,
        cdn_provider: 'cf-primary',
        is_warm: true,
        last_access_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
        manifest_url: channel.transcode_manifest_url || channel.original_url,
      }, { onConflict: 'cache_key' });

      warmed.push(channel.id);
    } catch (error) {
      failed.push({
        id: channel.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    warmed,
    failed,
    summary: {
      total: channelIds.length,
      warmed: warmed.length,
      failed: failed.length,
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleAnalytics(
  supabase: ReturnType<typeof createClient>,
  params: { timeRange?: string; channelId?: number }
): Promise<Response> {
  const { timeRange = '24h', channelId } = params;

  // Calculate time filter
  const hours = timeRange === '7d' ? 168 : timeRange === '1h' ? 1 : 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('iptv_channel_metrics')
    .select('channel_id, metric_type, value, recorded_at')
    .gte('recorded_at', since);

  if (channelId) {
    query = query.eq('channel_id', channelId);
  }

  const { data: metrics } = await query;

  if (!metrics?.length) {
    return new Response(JSON.stringify({
      success: true,
      analytics: {
        avgLatency: 0,
        avgBandwidth: 0,
        avgBufferHealth: 0,
        totalErrors: 0,
        sampleCount: 0,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Aggregate metrics
  const aggregated = {
    latency: { sum: 0, count: 0 },
    bandwidth: { sum: 0, count: 0 },
    buffer_health: { sum: 0, count: 0 },
    error_rate: { sum: 0, count: 0 },
  };

  for (const m of metrics) {
    const type = m.metric_type as keyof typeof aggregated;
    if (aggregated[type]) {
      aggregated[type].sum += m.value;
      aggregated[type].count += 1;
    }
  }

  const analytics = {
    avgLatency: aggregated.latency.count ? Math.round(aggregated.latency.sum / aggregated.latency.count) : 0,
    avgBandwidth: aggregated.bandwidth.count ? Math.round(aggregated.bandwidth.sum / aggregated.bandwidth.count) : 0,
    avgBufferHealth: aggregated.buffer_health.count ? Math.round(aggregated.buffer_health.sum / aggregated.buffer_health.count) : 0,
    totalErrors: aggregated.error_rate.sum,
    sampleCount: metrics.length,
    timeRange,
  };

  return new Response(JSON.stringify({ success: true, analytics }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    console.log('[iptv-performance] Action:', action);

    switch (action) {
      case 'optimize':
        return handleOptimize(supabase, params);
      case 'health-check':
        return handleHealthCheck(supabase, params);
      case 'metrics':
        return handleMetrics(supabase, params);
      case 'load-balance':
        return handleLoadBalance(supabase, params);
      case 'prewarm':
        return handlePrewarm(supabase, params);
      case 'analytics':
        return handleAnalytics(supabase, params);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[iptv-performance] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
