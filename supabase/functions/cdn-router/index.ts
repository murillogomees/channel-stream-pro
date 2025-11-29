/**
 * ============================================================================
 * CDN Router - Intelligent Content Routing
 * ============================================================================
 * 
 * Roteador inteligente que:
 * - Detecta tipo de conteúdo (Live vs VOD)
 * - Roteia VOD do R2 diretamente (bypass proxy)
 * - Roteia Live pelo stream-proxy
 * - Adiciona headers de cache otimizados
 * - Coleta métricas de performance
 * 
 * @version 1.0.0
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// CORS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, X-Route-Type, X-Cache-Status',
} as const;

// =============================================================================
// CONFIGURATION
// =============================================================================
const CONFIG = {
  // Cache TTLs
  VOD_CACHE_TTL: 86400,      // 24 hours for VOD
  LIVE_CACHE_TTL: 2,         // 2 seconds for live manifests
  SEGMENT_CACHE_TTL: 300,    // 5 minutes for segments
  
  // R2 settings
  R2_PUBLIC_DOMAIN: Deno.env.get('R2_PUBLIC_DOMAIN') || '',
  
  // Performance tracking
  TRACK_METRICS: true,
} as const;

// =============================================================================
// TYPES
// =============================================================================
interface RouteDecision {
  type: 'vod-r2' | 'vod-proxy' | 'live-proxy' | 'direct';
  targetUrl: string;
  cacheControl: string;
  contentType?: string;
}

interface StreamMetrics {
  routeType: string;
  responseTimeMs: number;
  contentSize?: number;
  cacheStatus: 'hit' | 'miss' | 'bypass';
}

// =============================================================================
// CONTENT DETECTION
// =============================================================================

function detectContentType(url: string): 'live' | 'vod' | 'manifest' | 'segment' | 'unknown' {
  const urlLower = url.toLowerCase();
  
  // Manifests
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u')) {
    return 'manifest';
  }
  
  // Segments
  if (urlLower.includes('.ts') || urlLower.includes('.m4s') || 
      urlLower.includes('.fmp4') || urlLower.includes('.aac')) {
    return 'segment';
  }
  
  // VOD patterns
  if (urlLower.includes('/movie/') || urlLower.includes('/series/') ||
      urlLower.includes('/vod/') || urlLower.includes('.mp4') ||
      urlLower.includes('.mkv')) {
    return 'vod';
  }
  
  // Live patterns
  if (urlLower.includes('/live/') || urlLower.includes('live.')) {
    return 'live';
  }
  
  // Xtream Codes live pattern
  const xtreamLivePattern = /\/(?:live\/)?[^\/]+\/[^\/]+\/\d+$/;
  if (xtreamLivePattern.test(url) && !urlLower.includes('.m3u')) {
    return 'live';
  }
  
  return 'unknown';
}

function isR2Url(url: string): boolean {
  return url.includes('r2.cloudflarestorage.com') || 
         url.includes(CONFIG.R2_PUBLIC_DOMAIN) ||
         url.includes('.r2.dev');
}

// =============================================================================
// ROUTE DECISION
// =============================================================================

async function decideRoute(
  url: string, 
  channelId?: string,
  supabase?: ReturnType<typeof createClient>
): Promise<RouteDecision> {
  const contentType = detectContentType(url);
  
  // If already R2 URL, serve directly
  if (isR2Url(url)) {
    return {
      type: 'vod-r2',
      targetUrl: url,
      cacheControl: `public, max-age=${CONFIG.VOD_CACHE_TTL}, immutable`,
    };
  }
  
  // Check if channel has R2 version
  if (channelId && supabase) {
    try {
      const { data: channel } = await supabase
        .from('m3u_channels')
        .select('r2_url, r2_uploaded, is_vod')
        .eq('id', channelId)
        .single();
      
      if (channel?.r2_uploaded && channel.r2_url) {
        return {
          type: 'vod-r2',
          targetUrl: channel.r2_url,
          cacheControl: `public, max-age=${CONFIG.VOD_CACHE_TTL}, immutable`,
        };
      }
    } catch {
      // Fall through to standard routing
    }
  }
  
  // Route based on content type
  switch (contentType) {
    case 'vod':
      return {
        type: 'vod-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: `public, max-age=${CONFIG.SEGMENT_CACHE_TTL}`,
      };
      
    case 'live':
      return {
        type: 'live-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: `public, max-age=${CONFIG.LIVE_CACHE_TTL}`,
      };
      
    case 'manifest':
      return {
        type: 'live-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: `public, max-age=${CONFIG.LIVE_CACHE_TTL}, stale-while-revalidate=2`,
      };
      
    case 'segment':
      return {
        type: 'vod-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: `public, max-age=${CONFIG.SEGMENT_CACHE_TTL}`,
      };
      
    default:
      return {
        type: 'direct',
        targetUrl: url,
        cacheControl: 'no-cache',
      };
  }
}

// =============================================================================
// METRICS TRACKING
// =============================================================================

async function trackMetrics(
  supabase: ReturnType<typeof createClient>,
  metrics: StreamMetrics,
  userId?: string,
  channelId?: string
): Promise<void> {
  if (!CONFIG.TRACK_METRICS) return;
  
  try {
    await supabase.from('stream_analytics').insert({
      user_id: userId || null,
      channel_id: channelId || null,
      route_type: metrics.routeType,
      response_time_ms: metrics.responseTimeMs,
      content_size_bytes: metrics.contentSize || null,
      cache_status: metrics.cacheStatus,
    });
  } catch (err) {
    console.error('[CDNRouter] Failed to track metrics:', err);
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    const channelId = url.searchParams.get('channelId');
    const userId = url.searchParams.get('userId');
    
    if (!streamUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const decodedUrl = decodeURIComponent(streamUrl);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Decide route
    const route = await decideRoute(decodedUrl, channelId || undefined, supabase);
    
    console.log(`[CDNRouter] ${route.type}: ${decodedUrl.substring(0, 50)}...`);

    // For R2 URLs, redirect directly
    if (route.type === 'vod-r2') {
      const responseHeaders = new Headers(CORS_HEADERS);
      responseHeaders.set('Location', route.targetUrl);
      responseHeaders.set('Cache-Control', route.cacheControl);
      responseHeaders.set('X-Route-Type', route.type);
      
      // Track metrics in background
      if (CONFIG.TRACK_METRICS) {
        const metrics: StreamMetrics = {
          routeType: route.type,
          responseTimeMs: Date.now() - startTime,
          cacheStatus: 'hit',
        };
        EdgeRuntime.waitUntil(trackMetrics(supabase, metrics, userId || undefined, channelId || undefined));
      }
      
      return new Response(null, {
        status: 302,
        headers: responseHeaders,
      });
    }

    // For proxy routes, forward the request
    const rangeHeader = req.headers.get('Range');
    const fetchHeaders = new Headers();
    if (rangeHeader) {
      fetchHeaders.set('Range', rangeHeader);
    }

    const proxyResponse = await fetch(route.targetUrl, {
      method: req.method,
      headers: fetchHeaders,
    });

    // Build response headers
    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set('Cache-Control', route.cacheControl);
    responseHeaders.set('X-Route-Type', route.type);
    responseHeaders.set('X-Cache-Status', 'MISS');

    // Copy relevant headers from proxy response
    const copyHeaders = ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'];
    copyHeaders.forEach(header => {
      const value = proxyResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    // Track metrics
    if (CONFIG.TRACK_METRICS) {
      const contentLength = proxyResponse.headers.get('Content-Length');
      const metrics: StreamMetrics = {
        routeType: route.type,
        responseTimeMs: Date.now() - startTime,
        contentSize: contentLength ? parseInt(contentLength) : undefined,
        cacheStatus: 'miss',
      };
      EdgeRuntime.waitUntil(trackMetrics(supabase, metrics, userId || undefined, channelId || undefined));
    }

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[CDNRouter] Error: ${message}`);
    
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
