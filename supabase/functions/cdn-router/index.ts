/**
 * ============================================================================
 * CDN Router - Intelligent Content Routing with Smart Cache
 * ============================================================================
 * 
 * Roteador inteligente que:
 * - Detecta tipo de conteúdo (Live vs VOD)
 * - Roteia VOD do R2 diretamente (bypass proxy)
 * - Roteia Live pelo stream-proxy
 * - Aplica regras de cache dinâmicas do banco de dados
 * - Normaliza cache keys
 * - Rastreia métricas de cache hit/miss
 * - Adiciona headers de cache otimizados
 * 
 * @version 2.0.0 - Smart Cache Integration
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// CORS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, X-Route-Type, X-Cache-Status, X-Cache-Key, X-Cache-Rule',
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
  TRACK_CACHE_STATS: true,
} as const;

// =============================================================================
// TYPES
// =============================================================================
interface RouteDecision {
  type: 'vod-r2' | 'vod-proxy' | 'live-proxy' | 'direct';
  targetUrl: string;
  cacheControl: string;
  contentType?: string;
  cacheKey?: string;
  appliedRuleId?: string;
}

interface StreamMetrics {
  routeType: string;
  responseTimeMs: number;
  contentSize?: number;
  cacheStatus: 'hit' | 'miss' | 'bypass';
}

interface CacheRule {
  id: string;
  name: string;
  match_pattern: string;
  match_type: string;
  ttl: number;
  stale_while_revalidate: number | null;
  stale_if_error: number | null;
  enabled: boolean;
  priority: number;
}

// =============================================================================
// CACHE KEY NORMALIZATION
// =============================================================================

/**
 * Generates normalized cache key from URL
 * - Sorts query parameters alphabetically
 * - Strips tracking parameters (utm_*, fbclid, gclid, etc.)
 * - Normalizes domain case
 * - Removes trailing slashes
 */
function generateCacheKey(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Normalize domain to lowercase
    const domain = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash
    
    // Parse and sort query parameters
    const params = new URLSearchParams(urlObj.search);
    const sortedParams: [string, string][] = [];
    
    // Strip tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
                           'fbclid', 'gclid', 'msclkid', '_ga', '_gl'];
    
    params.forEach((value, key) => {
      if (!trackingParams.includes(key.toLowerCase())) {
        sortedParams.push([key, value]);
      }
    });
    
    // Sort alphabetically
    sortedParams.sort((a, b) => a[0].localeCompare(b[0]));
    
    // Reconstruct query string
    const queryString = sortedParams.length > 0 
      ? '?' + sortedParams.map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    
    return `${domain}${pathname}${queryString}`;
  } catch (error) {
    console.error('[CDNRouter] Cache key generation failed:', error);
    return url; // Fallback to original URL
  }
}

// =============================================================================
// CACHE RULES MANAGEMENT
// =============================================================================

/**
 * Fetches enabled cache rules from database, sorted by priority
 */
async function fetchCacheRules(supabase: ReturnType<typeof createClient>): Promise<CacheRule[]> {
  try {
    const { data, error } = await supabase
      .from('cache_rules')
      .select('id, name, match_pattern, match_type, ttl, stale_while_revalidate, stale_if_error, enabled, priority')
      .eq('enabled', true)
      .order('priority', { ascending: false });
    
    if (error) {
      console.error('[CDNRouter] Error fetching cache rules:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('[CDNRouter] Failed to fetch cache rules:', error);
    return [];
  }
}

/**
 * Finds matching cache rule for given URL
 */
function findMatchingRule(url: string, rules: CacheRule[]): CacheRule | null {
  for (const rule of rules) {
    try {
      if (rule.match_type === 'exact' && url === rule.match_pattern) {
        return rule;
      } else if (rule.match_type === 'prefix' && url.startsWith(rule.match_pattern)) {
        return rule;
      } else if (rule.match_type === 'regex') {
        const regex = new RegExp(rule.match_pattern);
        if (regex.test(url)) {
          return rule;
        }
      }
    } catch (error) {
      console.error(`[CDNRouter] Error matching rule ${rule.id}:`, error);
    }
  }
  return null;
}

/**
 * Generates Cache-Control header from cache rule
 */
function generateCacheControlFromRule(rule: CacheRule): string {
  const directives = [`public`, `max-age=${rule.ttl}`];
  
  if (rule.stale_while_revalidate) {
    directives.push(`stale-while-revalidate=${rule.stale_while_revalidate}`);
  }
  
  if (rule.stale_if_error) {
    directives.push(`stale-if-error=${rule.stale_if_error}`);
  }
  
  return directives.join(', ');
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
  supabase?: ReturnType<typeof createClient>,
  cacheRules?: CacheRule[]
): Promise<RouteDecision> {
  const contentType = detectContentType(url);
  const cacheKey = generateCacheKey(url);
  
  // Find matching cache rule
  let matchedRule: CacheRule | null = null;
  let appliedRuleId: string | undefined;
  
  if (cacheRules && cacheRules.length > 0) {
    matchedRule = findMatchingRule(url, cacheRules);
    if (matchedRule) {
      appliedRuleId = matchedRule.id;
      console.log(`[CDNRouter] Applied cache rule: ${matchedRule.name}`);
    }
  }
  
  // If already R2 URL, serve directly
  if (isR2Url(url)) {
    const cacheControl = matchedRule 
      ? generateCacheControlFromRule(matchedRule)
      : `public, max-age=${CONFIG.VOD_CACHE_TTL}, immutable`;
      
    return {
      type: 'vod-r2',
      targetUrl: url,
      cacheControl,
      cacheKey,
      appliedRuleId,
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
        const cacheControl = matchedRule 
          ? generateCacheControlFromRule(matchedRule)
          : `public, max-age=${CONFIG.VOD_CACHE_TTL}, immutable`;
          
        return {
          type: 'vod-r2',
          targetUrl: channel.r2_url,
          cacheControl,
          cacheKey,
          appliedRuleId,
        };
      }
    } catch {
      // Fall through to standard routing
    }
  }
  
  // Helper to get cache control
  const getCacheControl = (defaultTTL: number, immutable = false) => {
    if (matchedRule) {
      return generateCacheControlFromRule(matchedRule);
    }
    const base = `public, max-age=${defaultTTL}`;
    return immutable ? `${base}, immutable` : base;
  };
  
  // Route based on content type
  switch (contentType) {
    case 'vod':
      return {
        type: 'vod-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: getCacheControl(CONFIG.SEGMENT_CACHE_TTL),
        cacheKey,
        appliedRuleId,
      };
      
    case 'live':
      return {
        type: 'live-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: getCacheControl(CONFIG.LIVE_CACHE_TTL),
        cacheKey,
        appliedRuleId,
      };
      
    case 'manifest':
      return {
        type: 'live-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: getCacheControl(CONFIG.LIVE_CACHE_TTL),
        cacheKey,
        appliedRuleId,
      };
      
    case 'segment':
      return {
        type: 'vod-proxy',
        targetUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`,
        cacheControl: getCacheControl(CONFIG.SEGMENT_CACHE_TTL),
        cacheKey,
        appliedRuleId,
      };
      
    default:
      return {
        type: 'direct',
        targetUrl: url,
        cacheControl: 'no-cache',
        cacheKey,
        appliedRuleId,
      };
  }
}

// =============================================================================
// METRICS TRACKING
// =============================================================================

/**
 * Track cache statistics in database
 */
async function trackCacheStats(
  supabase: ReturnType<typeof createClient>,
  ruleId: string | undefined,
  cacheStatus: 'hit' | 'miss' | 'stale' | 'error',
  responseTimeMs: number
): Promise<void> {
  if (!CONFIG.TRACK_CACHE_STATS) return;

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60000); // 1 minute window
    
    await supabase.from('cache_stats').insert({
      rule_id: ruleId || null,
      hits: cacheStatus === 'hit' ? 1 : 0,
      misses: cacheStatus === 'miss' ? 1 : 0,
      stale_hits: cacheStatus === 'stale' ? 1 : 0,
      errors: cacheStatus === 'error' ? 1 : 0,
      avg_response_time_ms: responseTimeMs,
      p95_response_time_ms: responseTimeMs,
      window_start: windowStart.toISOString(),
      window_end: now.toISOString(),
    });

    console.log(`[CDNRouter] Cache stats tracked: ${cacheStatus}`);
  } catch (error) {
    console.error('[CDNRouter] Failed to track cache stats:', error);
  }
}

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

    // Fetch cache rules
    const cacheRules = await fetchCacheRules(supabase);
    console.log(`[CDNRouter] Loaded ${cacheRules.length} cache rules`);

    // Decide route with cache rules
    const route = await decideRoute(decodedUrl, channelId || undefined, supabase, cacheRules);
    
    console.log(`[CDNRouter] ${route.type}: ${decodedUrl.substring(0, 50)}...`);

    // For R2 URLs, redirect directly
    if (route.type === 'vod-r2') {
      const responseHeaders = new Headers(CORS_HEADERS);
      responseHeaders.set('Location', route.targetUrl);
      responseHeaders.set('Cache-Control', route.cacheControl);
      responseHeaders.set('X-Route-Type', route.type);
      responseHeaders.set('X-Cache-Key', route.cacheKey || '');
      responseHeaders.set('X-Cache-Rule', route.appliedRuleId || 'default');
      
      const responseTime = Date.now() - startTime;
      
      // Track cache stats
      if (CONFIG.TRACK_CACHE_STATS && route.appliedRuleId) {
        EdgeRuntime.waitUntil(
          trackCacheStats(supabase, route.appliedRuleId, 'hit', responseTime)
        );
      }
      
      // Track metrics
      if (CONFIG.TRACK_METRICS) {
        const metrics: StreamMetrics = {
          routeType: route.type,
          responseTimeMs: responseTime,
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
    responseHeaders.set('X-Cache-Key', route.cacheKey || '');
    responseHeaders.set('X-Cache-Rule', route.appliedRuleId || 'default');
    
    const cfCacheStatus = proxyResponse.headers.get('CF-Cache-Status') || 'MISS';
    responseHeaders.set('X-Cache-Status', cfCacheStatus);

    // Copy relevant headers from proxy response
    const copyHeaders = ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'];
    copyHeaders.forEach(header => {
      const value = proxyResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    const responseTime = Date.now() - startTime;
    
    // Track cache stats
    if (CONFIG.TRACK_CACHE_STATS && route.appliedRuleId) {
      const cacheStatus = cfCacheStatus.toLowerCase().includes('hit') ? 'hit' : 'miss';
      EdgeRuntime.waitUntil(
        trackCacheStats(supabase, route.appliedRuleId, cacheStatus, responseTime)
      );
    }

    // Track metrics
    if (CONFIG.TRACK_METRICS) {
      const contentLength = proxyResponse.headers.get('Content-Length');
      const metrics: StreamMetrics = {
        routeType: route.type,
        responseTimeMs: responseTime,
        contentSize: contentLength ? parseInt(contentLength) : undefined,
        cacheStatus: cfCacheStatus.toLowerCase().includes('hit') ? 'hit' : 'miss',
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
