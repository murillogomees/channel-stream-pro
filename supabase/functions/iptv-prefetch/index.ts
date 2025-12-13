import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * IPTV Prefetch Orchestrator
 * Intelligent segment and manifest prefetching based on viewing patterns
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrefetchStrategy {
  type: 'aggressive' | 'conservative' | 'adaptive';
  segmentsAhead: number;
  manifestRefreshRate: number; // seconds
  priorityChannels: number[];
}

interface ViewingPattern {
  channelId: number;
  viewCount: number;
  avgDuration: number;
  lastViewed: string;
  peakHours: number[];
}

interface PrefetchTask {
  id: string;
  channelId: number;
  url: string;
  priority: number;
  type: 'manifest' | 'segment' | 'logo';
  scheduled: string;
}

// Default prefetch configurations
const PREFETCH_CONFIGS = {
  aggressive: {
    segmentsAhead: 5,
    manifestRefreshRate: 5,
    maxConcurrent: 10,
    cacheWarmupChannels: 20,
  },
  conservative: {
    segmentsAhead: 2,
    manifestRefreshRate: 10,
    maxConcurrent: 3,
    cacheWarmupChannels: 5,
  },
  adaptive: {
    segmentsAhead: 3,
    manifestRefreshRate: 8,
    maxConcurrent: 5,
    cacheWarmupChannels: 10,
  },
};

async function analyzeViewingPatterns(
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<ViewingPattern[]> {
  // Get viewing history from player events
  let query = supabase
    .from('player_events')
    .select('content_id, created_at, event_type, event_data')
    .eq('content_type', 'channel')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: events } = await query;

  if (!events?.length) {
    return [];
  }

  // Aggregate by channel
  const patterns: Map<number, ViewingPattern> = new Map();

  for (const event of events) {
    const channelId = parseInt(event.content_id || '0');
    if (!channelId) continue;

    const existing = patterns.get(channelId) || {
      channelId,
      viewCount: 0,
      avgDuration: 0,
      lastViewed: '',
      peakHours: [],
    };

    existing.viewCount++;
    existing.lastViewed = event.created_at;
    
    const hour = new Date(event.created_at).getHours();
    if (!existing.peakHours.includes(hour)) {
      existing.peakHours.push(hour);
    }

    patterns.set(channelId, existing);
  }

  return Array.from(patterns.values())
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 50);
}

async function generatePrefetchPlan(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId?: string;
    strategy: 'aggressive' | 'conservative' | 'adaptive';
    currentChannelId?: number;
  }
): Promise<Response> {
  const { userId, strategy = 'adaptive', currentChannelId } = params;
  const config = PREFETCH_CONFIGS[strategy];

  console.log('[prefetch] Generating plan:', { strategy, currentChannelId });

  // Get viewing patterns
  const patterns = await analyzeViewingPatterns(supabase, userId);

  // Get current hour for peak detection
  const currentHour = new Date().getHours();

  // Prioritize channels based on patterns and current context
  const prioritizedChannels = patterns
    .map(p => ({
      ...p,
      priority: calculatePriority(p, currentChannelId, currentHour),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, config.cacheWarmupChannels);

  // Get channel URLs
  const channelIds = prioritizedChannels.map(p => p.channelId);
  const { data: channels } = await supabase
    .from('iptv_channels')
    .select('id, name, original_url, transcode_manifest_url, logo_url')
    .in('id', channelIds);

  // Generate prefetch tasks
  const tasks: PrefetchTask[] = [];
  
  for (const pattern of prioritizedChannels) {
    const channel = channels?.find(c => c.id === pattern.channelId);
    if (!channel) continue;

    // Manifest prefetch
    tasks.push({
      id: `manifest-${channel.id}`,
      channelId: channel.id,
      url: channel.transcode_manifest_url || channel.original_url,
      priority: pattern.priority,
      type: 'manifest',
      scheduled: new Date().toISOString(),
    });

    // Logo prefetch
    if (channel.logo_url) {
      tasks.push({
        id: `logo-${channel.id}`,
        channelId: channel.id,
        url: channel.logo_url,
        priority: pattern.priority - 10,
        type: 'logo',
        scheduled: new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    strategy: {
      type: strategy,
      config,
    },
    tasks: tasks.sort((a, b) => b.priority - a.priority),
    patterns: prioritizedChannels.slice(0, 10),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function calculatePriority(
  pattern: ViewingPattern,
  currentChannelId?: number,
  currentHour?: number
): number {
  let priority = 0;

  // Base priority from view count
  priority += Math.min(50, pattern.viewCount * 5);

  // Recency bonus
  const daysSinceViewed = (Date.now() - new Date(pattern.lastViewed).getTime()) / (1000 * 60 * 60 * 24);
  priority += Math.max(0, 30 - daysSinceViewed * 3);

  // Peak hour bonus
  if (currentHour !== undefined && pattern.peakHours.includes(currentHour)) {
    priority += 20;
  }

  // Adjacent channel bonus (likely to switch)
  if (currentChannelId && Math.abs(pattern.channelId - currentChannelId) < 5) {
    priority += 15;
  }

  return Math.round(priority);
}

async function handleExecutePrefetch(
  supabase: ReturnType<typeof createClient>,
  params: { tasks: PrefetchTask[] }
): Promise<Response> {
  const { tasks } = params;
  const results: Array<{ id: string; success: boolean; latency?: number; error?: string }> = [];

  for (const task of tasks.slice(0, 10)) { // Limit concurrent
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(task.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Cache the result
      if (response.ok) {
        await supabase.from('iptv_cdn_cache').upsert({
          channel_id: task.channelId,
          cache_key: task.id,
          cdn_provider: 'prefetch',
          is_warm: true,
          last_access_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 300000).toISOString(), // 5 min TTL
        }, { onConflict: 'cache_key' });
      }

      results.push({
        id: task.id,
        success: response.ok,
        latency: Date.now() - start,
      });
    } catch (error) {
      results.push({
        id: task.id,
        success: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const avgLatency = results.reduce((s, r) => s + (r.latency || 0), 0) / results.length;

  return new Response(JSON.stringify({
    success: true,
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      avgLatency: Math.round(avgLatency),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSegmentPrefetch(params: {
  manifestUrl: string;
  currentSegment: number;
  segmentsAhead: number;
}): Promise<Response> {
  const { manifestUrl, currentSegment, segmentsAhead = 3 } = params;

  console.log('[prefetch] Segment prefetch:', { manifestUrl, currentSegment, segmentsAhead });

  try {
    // Fetch manifest
    const response = await fetch(manifestUrl);
    const manifestText = await response.text();

    // Parse segments (simplified HLS parsing)
    const lines = manifestText.split('\n');
    const segments: string[] = [];
    const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);

    for (const line of lines) {
      if (line.endsWith('.ts') || line.endsWith('.m4s')) {
        const segmentUrl = line.startsWith('http') ? line : baseUrl + line;
        segments.push(segmentUrl);
      }
    }

    // Get segments to prefetch
    const prefetchUrls = segments.slice(
      currentSegment,
      currentSegment + segmentsAhead
    );

    return new Response(JSON.stringify({
      success: true,
      totalSegments: segments.length,
      currentSegment,
      prefetchUrls,
      nextRefresh: 4000, // Refresh after 4 seconds (segment duration)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse manifest',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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

    console.log('[prefetch] Action:', action);

    switch (action) {
      case 'plan':
        return generatePrefetchPlan(supabase, params);
      case 'execute':
        return handleExecutePrefetch(supabase, params);
      case 'segments':
        return handleSegmentPrefetch(params);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[prefetch] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
