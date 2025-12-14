/**
 * IPTV Origin Failover - Phase 2
 * 
 * Multi-origin failover with geo-routing for maximum stream reliability.
 * Features:
 * - Multiple origin servers with health tracking
 * - Geo-based routing for lowest latency
 * - Automatic failover on origin failure
 * - Real-time health scoring
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Origin {
  id: string;
  url: string;
  region: string;
  healthScore: number;
  lastCheck: number;
  latencyMs: number;
  isHealthy: boolean;
  failCount: number;
}

interface OriginHealth {
  origin_id: string;
  url: string;
  region: string;
  health_score: number;
  latency_ms: number;
  is_healthy: boolean;
  fail_count: number;
  last_check_at: string;
}

// In-memory cache for origin health (refreshed every 30s)
let originsCache: Origin[] = [];
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 30000;

async function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

async function refreshOriginsCache(supabase: ReturnType<typeof createClient>) {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL_MS && originsCache.length > 0) {
    return originsCache;
  }

  console.log('[OriginFailover] Refreshing origins cache...');
  
  const { data, error } = await supabase
    .from('iptv_origin_servers')
    .select('*')
    .eq('is_active', true)
    .order('health_score', { ascending: false });

  if (error) {
    console.error('[OriginFailover] Failed to fetch origins:', error);
    return originsCache; // Return stale cache on error
  }

  originsCache = (data || []).map((o: OriginHealth) => ({
    id: o.origin_id,
    url: o.url,
    region: o.region,
    healthScore: o.health_score,
    latencyMs: o.latency_ms,
    isHealthy: o.is_healthy,
    failCount: o.fail_count,
    lastCheck: new Date(o.last_check_at).getTime(),
  }));

  lastCacheRefresh = now;
  console.log(`[OriginFailover] Cached ${originsCache.length} origins`);
  return originsCache;
}

function selectBestOrigin(origins: Origin[], clientRegion?: string): Origin | null {
  if (origins.length === 0) return null;

  // Filter healthy origins
  const healthyOrigins = origins.filter(o => o.isHealthy && o.healthScore >= 50);
  
  if (healthyOrigins.length === 0) {
    // Fallback to any origin with lowest fail count
    const sorted = [...origins].sort((a, b) => a.failCount - b.failCount);
    return sorted[0] || null;
  }

  // If client region provided, prefer same-region origins
  if (clientRegion) {
    const sameRegion = healthyOrigins.filter(o => 
      o.region.toLowerCase() === clientRegion.toLowerCase()
    );
    if (sameRegion.length > 0) {
      // Sort by latency within same region
      return sameRegion.sort((a, b) => a.latencyMs - b.latencyMs)[0];
    }
  }

  // Default: sort by health score then latency
  return healthyOrigins.sort((a, b) => {
    const scoreDiff = b.healthScore - a.healthScore;
    if (Math.abs(scoreDiff) > 10) return scoreDiff;
    return a.latencyMs - b.latencyMs;
  })[0];
}

async function probeOrigin(origin: Origin): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(origin.url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const latency = Date.now() - start;
    
    return {
      healthy: response.ok || response.status === 302 || response.status === 301,
      latency,
    };
  } catch (err) {
    console.warn(`[OriginFailover] Probe failed for ${origin.id}:`, err);
    return { healthy: false, latency: 9999 };
  }
}

async function updateOriginHealth(
  supabase: ReturnType<typeof createClient>,
  originId: string,
  healthy: boolean,
  latency: number
) {
  const { error } = await supabase
    .from('iptv_origin_servers')
    .update({
      is_healthy: healthy,
      latency_ms: latency,
      health_score: healthy 
        ? Math.min(100, 80 + Math.floor((5000 - latency) / 100))
        : Math.max(0, 30),
      fail_count: healthy ? 0 : supabase.rpc('increment_fail_count', { origin_id: originId }),
      last_check_at: new Date().toISOString(),
    })
    .eq('origin_id', originId);

  if (error) {
    console.error(`[OriginFailover] Failed to update health for ${originId}:`, error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = await getSupabaseClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'select';

    // Action: select best origin for streaming
    if (action === 'select') {
      const clientRegion = req.headers.get('cf-ipcountry') || 
                          req.headers.get('x-client-region') || 
                          undefined;
      const streamUrl = url.searchParams.get('stream');

      const origins = await refreshOriginsCache(supabase);
      const bestOrigin = selectBestOrigin(origins, clientRegion);

      if (!bestOrigin) {
        return new Response(JSON.stringify({ 
          error: 'NO_HEALTHY_ORIGINS',
          message: 'No healthy origins available',
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build proxied URL if stream provided
      const proxiedUrl = streamUrl 
        ? `${bestOrigin.url}${streamUrl.startsWith('/') ? '' : '/'}${streamUrl}`
        : bestOrigin.url;

      console.log(`[OriginFailover] Selected origin ${bestOrigin.id} (${bestOrigin.region}) for client ${clientRegion || 'unknown'}`);

      return new Response(JSON.stringify({
        origin: {
          id: bestOrigin.id,
          region: bestOrigin.region,
          healthScore: bestOrigin.healthScore,
          latencyMs: bestOrigin.latencyMs,
        },
        url: proxiedUrl,
        fallbacks: origins
          .filter(o => o.id !== bestOrigin.id && o.isHealthy)
          .slice(0, 2)
          .map(o => ({
            id: o.id,
            region: o.region,
            url: streamUrl ? `${o.url}${streamUrl.startsWith('/') ? '' : '/'}${streamUrl}` : o.url,
          })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: health check all origins
    if (action === 'health-check') {
      const { data: origins } = await supabase
        .from('iptv_origin_servers')
        .select('*')
        .eq('is_active', true);

      const results = await Promise.all(
        (origins || []).map(async (o: OriginHealth) => {
          const probe = await probeOrigin({
            id: o.origin_id,
            url: o.url,
            region: o.region,
            healthScore: o.health_score,
            latencyMs: o.latency_ms,
            isHealthy: o.is_healthy,
            failCount: o.fail_count,
            lastCheck: Date.now(),
          });
          
          await updateOriginHealth(supabase, o.origin_id, probe.healthy, probe.latency);
          
          return {
            id: o.origin_id,
            region: o.region,
            healthy: probe.healthy,
            latency: probe.latency,
          };
        })
      );

      // Invalidate cache after health check
      lastCacheRefresh = 0;

      return new Response(JSON.stringify({
        checked: results.length,
        healthy: results.filter(r => r.healthy).length,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: report failure (client-side failover trigger)
    if (action === 'report-failure' && req.method === 'POST') {
      const { originId, errorCode, streamUrl } = await req.json();
      
      console.warn(`[OriginFailover] Client reported failure: origin=${originId}, error=${errorCode}`);

      // Increment fail count
      const { error } = await supabase.rpc('increment_origin_fail_count', { 
        p_origin_id: originId 
      });

      if (error) {
        console.error('[OriginFailover] Failed to increment fail count:', error);
      }

      // Get next best origin
      const origins = await refreshOriginsCache(supabase);
      const clientRegion = req.headers.get('cf-ipcountry') || undefined;
      const filteredOrigins = origins.filter(o => o.id !== originId);
      const nextOrigin = selectBestOrigin(filteredOrigins, clientRegion);

      return new Response(JSON.stringify({
        acknowledged: true,
        nextOrigin: nextOrigin ? {
          id: nextOrigin.id,
          region: nextOrigin.region,
          url: streamUrl 
            ? `${nextOrigin.url}${streamUrl.startsWith('/') ? '' : '/'}${streamUrl}` 
            : nextOrigin.url,
        } : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: list all origins with status
    if (action === 'list') {
      const origins = await refreshOriginsCache(supabase);
      
      return new Response(JSON.stringify({
        origins: origins.map(o => ({
          id: o.id,
          region: o.region,
          healthScore: o.healthScore,
          latencyMs: o.latencyMs,
          isHealthy: o.isHealthy,
          failCount: o.failCount,
        })),
        cacheAge: Date.now() - lastCacheRefresh,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'INVALID_ACTION',
      validActions: ['select', 'health-check', 'report-failure', 'list'],
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[OriginFailover] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
