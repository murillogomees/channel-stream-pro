/**
 * IPTV Geo Router - Phase 2
 * 
 * Intelligent geo-based routing for optimal CDN/origin selection.
 * Features:
 * - Automatic region detection from request headers
 * - CDN selection based on latency and availability
 * - Fallback chains per region
 * - Real-time routing metrics
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegionConfig {
  region: string;
  primaryCDN: string;
  fallbackCDNs: string[];
  edgeLocations: string[];
}

interface CDNEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  region: string;
  priority: number;
  isHealthy: boolean;
  avgLatency: number;
}

// Region to CDN mapping (can be extended via database)
const REGION_CONFIGS: Record<string, RegionConfig> = {
  'BR': {
    region: 'South America',
    primaryCDN: 'cloudflare-gru',
    fallbackCDNs: ['cloudflare-mia', 'r2-default'],
    edgeLocations: ['GRU', 'GIG', 'POA'],
  },
  'US': {
    region: 'North America',
    primaryCDN: 'cloudflare-iad',
    fallbackCDNs: ['cloudflare-lax', 'r2-default'],
    edgeLocations: ['IAD', 'LAX', 'ORD', 'DFW'],
  },
  'DE': {
    region: 'Europe',
    primaryCDN: 'cloudflare-fra',
    fallbackCDNs: ['cloudflare-lhr', 'r2-default'],
    edgeLocations: ['FRA', 'LHR', 'AMS', 'CDG'],
  },
  'JP': {
    region: 'Asia Pacific',
    primaryCDN: 'cloudflare-nrt',
    fallbackCDNs: ['cloudflare-sin', 'r2-default'],
    edgeLocations: ['NRT', 'HND', 'KIX'],
  },
  'default': {
    region: 'Global',
    primaryCDN: 'r2-default',
    fallbackCDNs: ['cloudflare-iad'],
    edgeLocations: [],
  },
};

// CDN endpoints (can be extended via database)
const CDN_ENDPOINTS: Record<string, CDNEndpoint> = {
  'cloudflare-gru': {
    id: 'cloudflare-gru',
    name: 'Cloudflare São Paulo',
    baseUrl: 'https://cdn-gru.iptvlink.com.br',
    region: 'BR',
    priority: 1,
    isHealthy: true,
    avgLatency: 15,
  },
  'cloudflare-mia': {
    id: 'cloudflare-mia',
    name: 'Cloudflare Miami',
    baseUrl: 'https://cdn-mia.iptvlink.com.br',
    region: 'US-FL',
    priority: 2,
    isHealthy: true,
    avgLatency: 45,
  },
  'cloudflare-iad': {
    id: 'cloudflare-iad',
    name: 'Cloudflare Virginia',
    baseUrl: 'https://cdn-iad.iptvlink.com.br',
    region: 'US-VA',
    priority: 1,
    isHealthy: true,
    avgLatency: 20,
  },
  'cloudflare-lax': {
    id: 'cloudflare-lax',
    name: 'Cloudflare Los Angeles',
    baseUrl: 'https://cdn-lax.iptvlink.com.br',
    region: 'US-CA',
    priority: 2,
    isHealthy: true,
    avgLatency: 25,
  },
  'cloudflare-fra': {
    id: 'cloudflare-fra',
    name: 'Cloudflare Frankfurt',
    baseUrl: 'https://cdn-fra.iptvlink.com.br',
    region: 'DE',
    priority: 1,
    isHealthy: true,
    avgLatency: 18,
  },
  'cloudflare-lhr': {
    id: 'cloudflare-lhr',
    name: 'Cloudflare London',
    baseUrl: 'https://cdn-lhr.iptvlink.com.br',
    region: 'GB',
    priority: 2,
    isHealthy: true,
    avgLatency: 22,
  },
  'cloudflare-nrt': {
    id: 'cloudflare-nrt',
    name: 'Cloudflare Tokyo',
    baseUrl: 'https://cdn-nrt.iptvlink.com.br',
    region: 'JP',
    priority: 1,
    isHealthy: true,
    avgLatency: 12,
  },
  'cloudflare-sin': {
    id: 'cloudflare-sin',
    name: 'Cloudflare Singapore',
    baseUrl: 'https://cdn-sin.iptvlink.com.br',
    region: 'SG',
    priority: 2,
    isHealthy: true,
    avgLatency: 35,
  },
  'r2-default': {
    id: 'r2-default',
    name: 'Cloudflare R2 Global',
    baseUrl: 'https://cdn.iptvlink.com.br',
    region: 'global',
    priority: 10,
    isHealthy: true,
    avgLatency: 50,
  },
};

// In-memory health cache
const healthCache = new Map<string, { healthy: boolean; lastCheck: number; latency: number }>();
const HEALTH_CACHE_TTL = 60000; // 1 minute

async function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

function detectClientRegion(req: Request): string {
  // Try Cloudflare headers first
  const cfCountry = req.headers.get('cf-ipcountry');
  if (cfCountry) return cfCountry;

  // Try custom header
  const customRegion = req.headers.get('x-client-region');
  if (customRegion) return customRegion;

  // Try to detect from Accept-Language
  const acceptLang = req.headers.get('accept-language');
  if (acceptLang) {
    if (acceptLang.includes('pt-BR')) return 'BR';
    if (acceptLang.includes('en-US')) return 'US';
    if (acceptLang.includes('de')) return 'DE';
    if (acceptLang.includes('ja')) return 'JP';
  }

  return 'default';
}

async function checkCDNHealth(cdnId: string): Promise<{ healthy: boolean; latency: number }> {
  const cached = healthCache.get(cdnId);
  if (cached && Date.now() - cached.lastCheck < HEALTH_CACHE_TTL) {
    return { healthy: cached.healthy, latency: cached.latency };
  }

  const cdn = CDN_ENDPOINTS[cdnId];
  if (!cdn) {
    return { healthy: false, latency: 9999 };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${cdn.baseUrl}/health`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const healthy = response.ok;
    
    healthCache.set(cdnId, { healthy, latency, lastCheck: Date.now() });
    return { healthy, latency };
  } catch (err) {
    healthCache.set(cdnId, { healthy: false, latency: 9999, lastCheck: Date.now() });
    return { healthy: false, latency: 9999 };
  }
}

async function selectBestCDN(region: string): Promise<CDNEndpoint> {
  const config = REGION_CONFIGS[region] || REGION_CONFIGS['default'];
  
  // Check primary CDN health
  const primaryHealth = await checkCDNHealth(config.primaryCDN);
  if (primaryHealth.healthy) {
    const cdn = CDN_ENDPOINTS[config.primaryCDN];
    return { ...cdn, avgLatency: primaryHealth.latency };
  }

  // Try fallbacks in order
  for (const fallbackId of config.fallbackCDNs) {
    const fallbackHealth = await checkCDNHealth(fallbackId);
    if (fallbackHealth.healthy) {
      const cdn = CDN_ENDPOINTS[fallbackId];
      console.log(`[GeoRouter] Primary CDN ${config.primaryCDN} unhealthy, using fallback ${fallbackId}`);
      return { ...cdn, avgLatency: fallbackHealth.latency };
    }
  }

  // Last resort: return default with warning
  console.warn(`[GeoRouter] All CDNs for region ${region} are unhealthy, using r2-default`);
  return CDN_ENDPOINTS['r2-default'];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = await getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'route';

    // Action: route request to best CDN
    if (action === 'route') {
      const streamPath = url.searchParams.get('path') || '';
      const forceRegion = url.searchParams.get('region');
      
      const clientRegion = forceRegion || detectClientRegion(req);
      const bestCDN = await selectBestCDN(clientRegion);
      
      const routedUrl = streamPath 
        ? `${bestCDN.baseUrl}${streamPath.startsWith('/') ? '' : '/'}${streamPath}`
        : bestCDN.baseUrl;

      console.log(`[GeoRouter] Routed ${clientRegion} to ${bestCDN.id} (latency: ${bestCDN.avgLatency}ms)`);

      // Track routing decision
      await supabase.from('iptv_routing_logs').insert({
        client_region: clientRegion,
        selected_cdn: bestCDN.id,
        latency_ms: bestCDN.avgLatency,
        stream_path: streamPath || null,
        created_at: new Date().toISOString(),
      }).then(() => {}).catch(err => {
        console.warn('[GeoRouter] Failed to log routing:', err);
      });

      return new Response(JSON.stringify({
        cdn: {
          id: bestCDN.id,
          name: bestCDN.name,
          region: bestCDN.region,
          latency: bestCDN.avgLatency,
        },
        url: routedUrl,
        clientRegion,
        fallbacks: (REGION_CONFIGS[clientRegion] || REGION_CONFIGS['default'])
          .fallbackCDNs
          .filter(id => id !== bestCDN.id)
          .slice(0, 2)
          .map(id => ({
            id,
            url: streamPath 
              ? `${CDN_ENDPOINTS[id]?.baseUrl || ''}${streamPath.startsWith('/') ? '' : '/'}${streamPath}`
              : CDN_ENDPOINTS[id]?.baseUrl,
          })),
      }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-CDN-ID': bestCDN.id,
          'X-Client-Region': clientRegion,
        },
      });
    }

    // Action: check health of all CDNs
    if (action === 'health') {
      const results = await Promise.all(
        Object.keys(CDN_ENDPOINTS).map(async (cdnId) => {
          const health = await checkCDNHealth(cdnId);
          return {
            id: cdnId,
            name: CDN_ENDPOINTS[cdnId].name,
            region: CDN_ENDPOINTS[cdnId].region,
            ...health,
          };
        })
      );

      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        cdns: results.sort((a, b) => a.latency - b.latency),
        summary: {
          total: results.length,
          healthy: results.filter(r => r.healthy).length,
          avgLatency: Math.round(
            results.filter(r => r.healthy).reduce((sum, r) => sum + r.latency, 0) / 
            results.filter(r => r.healthy).length || 1
          ),
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get regions configuration
    if (action === 'regions') {
      return new Response(JSON.stringify({
        regions: Object.entries(REGION_CONFIGS).map(([code, config]) => ({
          code,
          name: config.region,
          primaryCDN: config.primaryCDN,
          fallbackCDNs: config.fallbackCDNs,
          edgeLocations: config.edgeLocations,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get CDN list
    if (action === 'cdns') {
      return new Response(JSON.stringify({
        cdns: Object.values(CDN_ENDPOINTS).map(cdn => ({
          id: cdn.id,
          name: cdn.name,
          region: cdn.region,
          priority: cdn.priority,
          baseUrl: cdn.baseUrl,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: get routing stats
    if (action === 'stats') {
      const { data: stats } = await supabase
        .from('iptv_routing_logs')
        .select('client_region, selected_cdn, latency_ms')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!stats || stats.length === 0) {
        return new Response(JSON.stringify({
          message: 'No routing stats available',
          period: '24h',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Aggregate stats
      const byRegion = stats.reduce((acc, s) => {
        acc[s.client_region] = (acc[s.client_region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byCDN = stats.reduce((acc, s) => {
        acc[s.selected_cdn] = (acc[s.selected_cdn] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const avgLatency = Math.round(
        stats.reduce((sum, s) => sum + (s.latency_ms || 0), 0) / stats.length
      );

      return new Response(JSON.stringify({
        period: '24h',
        totalRequests: stats.length,
        avgLatency,
        byRegion,
        byCDN,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'INVALID_ACTION',
      validActions: ['route', 'health', 'regions', 'cdns', 'stats'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GeoRouter] Error:', error);
    return new Response(JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
