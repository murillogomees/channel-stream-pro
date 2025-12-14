/**
 * IPTV LL-HLS Optimizer - Phase 2
 * 
 * Low-Latency HLS optimization for live streaming.
 * Features:
 * - Segment prefetching based on playlist analysis
 * - Part-based delivery for sub-segment latency
 * - Client buffer optimization hints
 * - Latency tracking and optimization metrics
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LLHLSConfig {
  partDuration: number;        // Part target duration in seconds (0.25-0.5)
  playlistWindow: number;      // Playlist window in seconds (default 30)
  holdBackMultiplier: number;  // Hold-back = partDuration * multiplier
  canSkipUntil: number;        // Delta update skip threshold
  prefetchSegments: number;    // Number of segments to prefetch
  targetLatency: number;       // Target end-to-end latency in seconds
}

interface StreamMetrics {
  channelId: number;
  currentLatency: number;
  bufferHealth: number;
  partsFetched: number;
  partsDropped: number;
  lastUpdate: number;
}

// Default LL-HLS configuration
const DEFAULT_CONFIG: LLHLSConfig = {
  partDuration: 0.33,
  playlistWindow: 30,
  holdBackMultiplier: 3,
  canSkipUntil: 12,
  prefetchSegments: 2,
  targetLatency: 2.0,
};

// In-memory metrics cache
const metricsCache = new Map<number, StreamMetrics>();

async function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

function parseM3U8Manifest(content: string): {
  isLLHLS: boolean;
  partDuration?: number;
  targetDuration?: number;
  mediaSequence?: number;
  segments: string[];
  parts: string[];
} {
  const lines = content.split('\n');
  const result = {
    isLLHLS: false,
    partDuration: undefined as number | undefined,
    targetDuration: undefined as number | undefined,
    mediaSequence: undefined as number | undefined,
    segments: [] as string[],
    parts: [] as string[],
  };

  for (const line of lines) {
    if (line.startsWith('#EXT-X-PART-INF:')) {
      result.isLLHLS = true;
      const match = line.match(/PART-TARGET=([0-9.]+)/);
      if (match) result.partDuration = parseFloat(match[1]);
    }
    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      result.targetDuration = parseInt(line.split(':')[1]);
    }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      result.mediaSequence = parseInt(line.split(':')[1]);
    }
    if (line.startsWith('#EXT-X-PART:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) result.parts.push(uriMatch[1]);
    }
    if (line.endsWith('.ts') || line.endsWith('.m4s')) {
      result.segments.push(line);
    }
  }

  return result;
}

function generateOptimizedManifest(
  originalContent: string,
  config: LLHLSConfig
): string {
  const lines = originalContent.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    // Add LL-HLS specific tags if not present
    if (line === '#EXTM3U') {
      output.push(line);
      output.push('#EXT-X-VERSION:9');
      continue;
    }

    // Inject server control for LL-HLS
    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      output.push(line);
      if (!originalContent.includes('#EXT-X-SERVER-CONTROL:')) {
        output.push(
          `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=${
            config.partDuration * config.holdBackMultiplier
          },CAN-SKIP-UNTIL=${config.canSkipUntil}`
        );
      }
      continue;
    }

    // Add part target info if missing
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:') && !originalContent.includes('#EXT-X-PART-INF:')) {
      output.push(`#EXT-X-PART-INF:PART-TARGET=${config.partDuration}`);
      output.push(line);
      continue;
    }

    output.push(line);
  }

  return output.join('\n');
}

function calculatePrefetchHints(
  manifest: ReturnType<typeof parseM3U8Manifest>,
  baseUrl: string,
  config: LLHLSConfig
): string[] {
  const hints: string[] = [];
  
  // Prefetch upcoming segments
  const segmentsToFetch = manifest.segments.slice(-config.prefetchSegments);
  for (const segment of segmentsToFetch) {
    hints.push(`${baseUrl}/${segment}`);
  }

  // Prefetch parts for LL-HLS streams
  if (manifest.isLLHLS && manifest.parts.length > 0) {
    const partsToFetch = manifest.parts.slice(-3);
    for (const part of partsToFetch) {
      hints.push(`${baseUrl}/${part}`);
    }
  }

  return hints;
}

function generateBufferHints(
  metrics: StreamMetrics | undefined,
  config: LLHLSConfig
): {
  recommendedBuffer: number;
  playbackRate: number;
  catchupMode: boolean;
} {
  if (!metrics) {
    return {
      recommendedBuffer: config.targetLatency * 1.5,
      playbackRate: 1.0,
      catchupMode: false,
    };
  }

  const latencyGap = metrics.currentLatency - config.targetLatency;
  
  if (latencyGap > 3) {
    // Significant lag - enable catchup
    return {
      recommendedBuffer: config.targetLatency,
      playbackRate: 1.05, // 5% faster to catch up
      catchupMode: true,
    };
  } else if (latencyGap > 1) {
    // Minor lag - slight speedup
    return {
      recommendedBuffer: config.targetLatency * 1.2,
      playbackRate: 1.02,
      catchupMode: false,
    };
  } else if (latencyGap < -1) {
    // Too close to live edge - slow down slightly
    return {
      recommendedBuffer: config.targetLatency * 1.5,
      playbackRate: 0.98,
      catchupMode: false,
    };
  }

  return {
    recommendedBuffer: config.targetLatency * 1.3,
    playbackRate: 1.0,
    catchupMode: false,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = await getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'optimize';

    // Action: optimize manifest for LL-HLS
    if (action === 'optimize') {
      const manifestUrl = url.searchParams.get('manifest');
      const channelId = parseInt(url.searchParams.get('channelId') || '0');

      if (!manifestUrl) {
        return new Response(JSON.stringify({
          error: 'MISSING_MANIFEST_URL',
          message: 'manifest parameter is required',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch original manifest
      const manifestResponse = await fetch(manifestUrl, {
        headers: { 'User-Agent': 'IPTV-LLHLS-Optimizer/1.0' },
      });

      if (!manifestResponse.ok) {
        return new Response(JSON.stringify({
          error: 'MANIFEST_FETCH_FAILED',
          status: manifestResponse.status,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const originalContent = await manifestResponse.text();
      const parsed = parseM3U8Manifest(originalContent);
      
      // Get channel-specific config if available
      let config = DEFAULT_CONFIG;
      if (channelId > 0) {
        const { data: channelConfig } = await supabase
          .from('iptv_llhls_config')
          .select('*')
          .eq('channel_id', channelId)
          .maybeSingle();
        
        if (channelConfig) {
          config = { ...DEFAULT_CONFIG, ...channelConfig };
        }
      }

      // Generate optimized manifest
      const optimizedContent = generateOptimizedManifest(originalContent, config);
      
      // Generate prefetch hints
      const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'));
      const prefetchHints = calculatePrefetchHints(parsed, baseUrl, config);

      // Get buffer hints
      const metrics = metricsCache.get(channelId);
      const bufferHints = generateBufferHints(metrics, config);

      console.log(`[LLHLS] Optimized manifest for channel ${channelId}: isLLHLS=${parsed.isLLHLS}, segments=${parsed.segments.length}, parts=${parsed.parts.length}`);

      return new Response(JSON.stringify({
        manifest: optimizedContent,
        isLLHLS: parsed.isLLHLS,
        prefetch: prefetchHints,
        bufferHints,
        config: {
          targetLatency: config.targetLatency,
          partDuration: parsed.partDuration || config.partDuration,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: report client metrics
    if (action === 'metrics' && req.method === 'POST') {
      const body = await req.json();
      const { channelId, currentLatency, bufferHealth, partsFetched, partsDropped } = body;

      if (!channelId) {
        return new Response(JSON.stringify({
          error: 'MISSING_CHANNEL_ID',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update in-memory cache
      metricsCache.set(channelId, {
        channelId,
        currentLatency: currentLatency || 0,
        bufferHealth: bufferHealth || 100,
        partsFetched: partsFetched || 0,
        partsDropped: partsDropped || 0,
        lastUpdate: Date.now(),
      });

      // Persist to database periodically (every 10 updates)
      const existingMetrics = metricsCache.get(channelId);
      if (existingMetrics && existingMetrics.partsFetched % 10 === 0) {
        await supabase.from('iptv_channel_metrics').insert({
          channel_id: channelId,
          metric_type: 'llhls_latency',
          value: currentLatency || 0,
          recorded_at: new Date().toISOString(),
        });
      }

      // Return updated buffer hints
      const bufferHints = generateBufferHints(metricsCache.get(channelId), DEFAULT_CONFIG);

      return new Response(JSON.stringify({
        acknowledged: true,
        bufferHints,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get channel LL-HLS config
    if (action === 'config') {
      const channelId = parseInt(url.searchParams.get('channelId') || '0');

      if (channelId === 0) {
        return new Response(JSON.stringify({
          config: DEFAULT_CONFIG,
          isDefault: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: channelConfig } = await supabase
        .from('iptv_llhls_config')
        .select('*')
        .eq('channel_id', channelId)
        .maybeSingle();

      return new Response(JSON.stringify({
        config: channelConfig ? { ...DEFAULT_CONFIG, ...channelConfig } : DEFAULT_CONFIG,
        isDefault: !channelConfig,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: analyze manifest for LL-HLS compatibility
    if (action === 'analyze') {
      const manifestUrl = url.searchParams.get('manifest');

      if (!manifestUrl) {
        return new Response(JSON.stringify({
          error: 'MISSING_MANIFEST_URL',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const manifestResponse = await fetch(manifestUrl, {
        headers: { 'User-Agent': 'IPTV-LLHLS-Analyzer/1.0' },
      });

      if (!manifestResponse.ok) {
        return new Response(JSON.stringify({
          error: 'MANIFEST_FETCH_FAILED',
          status: manifestResponse.status,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const content = await manifestResponse.text();
      const parsed = parseM3U8Manifest(content);

      return new Response(JSON.stringify({
        isLLHLS: parsed.isLLHLS,
        partDuration: parsed.partDuration,
        targetDuration: parsed.targetDuration,
        mediaSequence: parsed.mediaSequence,
        segmentCount: parsed.segments.length,
        partCount: parsed.parts.length,
        canOptimize: !parsed.isLLHLS, // Can add LL-HLS tags
        recommendations: parsed.isLLHLS ? [] : [
          'Add #EXT-X-SERVER-CONTROL for blocking reload',
          'Add #EXT-X-PART-INF for part target duration',
          'Consider reducing segment duration for lower latency',
        ],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'INVALID_ACTION',
      validActions: ['optimize', 'metrics', 'config', 'analyze'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[LLHLS Optimizer] Error:', error);
    return new Response(JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
