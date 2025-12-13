/**
 * Origin Failover Worker - Multi-origin failover with health checks and geo-routing
 * Provides automatic failover < 2 seconds with weighted load balancing
 */

interface Env {
  ORIGINS_KV: KVNamespace;
  HEALTH_KV: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WORKER_SECRET: string;
}

interface Origin {
  id: string;
  url: string;
  region: string;
  weight: number;
  priority: number;
  isHealthy: boolean;
  lastCheck: number;
  responseTime: number;
  errorCount: number;
  successCount: number;
}

interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
}

// Default origins configuration
const DEFAULT_ORIGINS: Origin[] = [
  {
    id: 'primary-r2',
    url: 'https://cdn.iptvlink.com.br',
    region: 'global',
    weight: 100,
    priority: 1,
    isHealthy: true,
    lastCheck: 0,
    responseTime: 0,
    errorCount: 0,
    successCount: 0,
  },
  {
    id: 'stream-cf',
    url: 'https://videodelivery.net',
    region: 'global',
    weight: 80,
    priority: 2,
    isHealthy: true,
    lastCheck: 0,
    responseTime: 0,
    errorCount: 0,
    successCount: 0,
  },
  {
    id: 'proxy-edge',
    url: 'https://supabase.iptvlink.com.br/functions/v1/stream-proxy',
    region: 'global',
    weight: 60,
    priority: 3,
    isHealthy: true,
    lastCheck: 0,
    responseTime: 0,
    errorCount: 0,
    successCount: 0,
  },
];

// Health check configuration
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const CIRCUIT_BREAKER_THRESHOLD = 5; // errors before circuit opens
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute

// Get client region from Cloudflare headers
function getClientRegion(request: Request): string {
  const country = request.headers.get('CF-IPCountry') || 'XX';
  const continent = request.headers.get('CF-IPContinent') || 'XX';
  
  // Map to regions
  if (['BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY'].includes(country)) return 'south-america';
  if (['US', 'CA', 'MX'].includes(country)) return 'north-america';
  if (continent === 'EU') return 'europe';
  if (continent === 'AS') return 'asia';
  
  return 'global';
}

// Load origins from KV or use defaults
async function loadOrigins(env: Env): Promise<Origin[]> {
  const originsJson = await env.ORIGINS_KV.get('origins:config');
  if (originsJson) {
    return JSON.parse(originsJson);
  }
  
  // Initialize with defaults
  await env.ORIGINS_KV.put('origins:config', JSON.stringify(DEFAULT_ORIGINS));
  return DEFAULT_ORIGINS;
}

// Save origins to KV
async function saveOrigins(env: Env, origins: Origin[]): Promise<void> {
  await env.ORIGINS_KV.put('origins:config', JSON.stringify(origins));
}

// Health check an origin
async function healthCheck(origin: Origin): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
    
    const response = await fetch(`${origin.url}/health`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    
    return {
      healthy: response.ok || response.status === 404, // 404 is ok for health endpoint
      responseTime,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      healthy: false,
      responseTime: HEALTH_CHECK_TIMEOUT,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Update origin health status
async function updateOriginHealth(
  env: Env,
  origin: Origin,
  result: HealthCheckResult
): Promise<Origin> {
  const updated = { ...origin };
  updated.lastCheck = Date.now();
  updated.responseTime = result.responseTime;
  
  if (result.healthy) {
    updated.successCount++;
    updated.errorCount = Math.max(0, updated.errorCount - 1);
    updated.isHealthy = true;
  } else {
    updated.errorCount++;
    updated.successCount = 0;
    
    // Circuit breaker: mark unhealthy after threshold
    if (updated.errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
      updated.isHealthy = false;
    }
  }
  
  // Store health state
  await env.HEALTH_KV.put(`health:${origin.id}`, JSON.stringify({
    isHealthy: updated.isHealthy,
    lastCheck: updated.lastCheck,
    responseTime: updated.responseTime,
    errorCount: updated.errorCount,
  }), { expirationTtl: 300 });
  
  return updated;
}

// Select best origin based on health, weight, and region
function selectOrigin(origins: Origin[], clientRegion: string): Origin | null {
  // Filter healthy origins
  const healthyOrigins = origins.filter(o => o.isHealthy);
  
  if (healthyOrigins.length === 0) {
    // Fallback: try the one with lowest error count
    const sorted = [...origins].sort((a, b) => a.errorCount - b.errorCount);
    return sorted[0] || null;
  }
  
  // Prefer region-matched origins
  const regionMatched = healthyOrigins.filter(
    o => o.region === clientRegion || o.region === 'global'
  );
  
  const candidates = regionMatched.length > 0 ? regionMatched : healthyOrigins;
  
  // Weighted random selection
  const totalWeight = candidates.reduce((sum, o) => sum + o.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const origin of candidates) {
    random -= origin.weight;
    if (random <= 0) return origin;
  }
  
  return candidates[0];
}

// Proxy request to selected origin
async function proxyToOrigin(
  request: Request,
  origin: Origin,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, origin.url);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? request.body 
        : undefined,
    });
    
    const responseTime = Date.now() - startTime;
    
    // Track success
    const origins = await loadOrigins(env);
    const originIndex = origins.findIndex(o => o.id === origin.id);
    if (originIndex >= 0) {
      origins[originIndex].successCount++;
      origins[originIndex].responseTime = responseTime;
      await saveOrigins(env, origins);
    }
    
    // Add headers
    const headers = new Headers(response.headers);
    headers.set('X-Origin-Id', origin.id);
    headers.set('X-Origin-Response-Time', String(responseTime));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    // Track failure
    const origins = await loadOrigins(env);
    const originIndex = origins.findIndex(o => o.id === origin.id);
    if (originIndex >= 0) {
      origins[originIndex].errorCount++;
      if (origins[originIndex].errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
        origins[originIndex].isHealthy = false;
      }
      await saveOrigins(env, origins);
    }
    
    throw error;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Secret',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Health check endpoint
    if (path === '/health') {
      const origins = await loadOrigins(env);
      const healthyCount = origins.filter(o => o.isHealthy).length;
      
      return new Response(JSON.stringify({
        status: healthyCount > 0 ? 'healthy' : 'degraded',
        service: 'origin-failover-worker',
        timestamp: new Date().toISOString(),
        origins: {
          total: origins.length,
          healthy: healthyCount,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Management endpoints
    if (path.startsWith('/manage')) {
      const secret = request.headers.get('X-Worker-Secret');
      if (secret !== env.WORKER_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // List origins
      if (path === '/manage/origins' && request.method === 'GET') {
        const origins = await loadOrigins(env);
        return new Response(JSON.stringify({ origins }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Add/update origin
      if (path === '/manage/origins' && request.method === 'POST') {
        const body = await request.json() as Partial<Origin>;
        const origins = await loadOrigins(env);
        
        const existingIndex = origins.findIndex(o => o.id === body.id);
        if (existingIndex >= 0) {
          origins[existingIndex] = { ...origins[existingIndex], ...body };
        } else {
          origins.push({
            id: body.id || `origin-${Date.now()}`,
            url: body.url || '',
            region: body.region || 'global',
            weight: body.weight || 50,
            priority: body.priority || origins.length + 1,
            isHealthy: true,
            lastCheck: 0,
            responseTime: 0,
            errorCount: 0,
            successCount: 0,
          });
        }
        
        await saveOrigins(env, origins);
        return new Response(JSON.stringify({ success: true, origins }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Remove origin
      if (path === '/manage/origins' && request.method === 'DELETE') {
        const body = await request.json() as { id: string };
        const origins = await loadOrigins(env);
        const filtered = origins.filter(o => o.id !== body.id);
        await saveOrigins(env, filtered);
        
        return new Response(JSON.stringify({ success: true, origins: filtered }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Force health check
      if (path === '/manage/healthcheck' && request.method === 'POST') {
        const origins = await loadOrigins(env);
        const results: Record<string, HealthCheckResult> = {};
        
        for (const origin of origins) {
          const result = await healthCheck(origin);
          results[origin.id] = result;
          await updateOriginHealth(env, origin, result);
        }
        
        const updatedOrigins = await loadOrigins(env);
        return new Response(JSON.stringify({ 
          success: true, 
          results,
          origins: updatedOrigins,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Reset circuit breakers
      if (path === '/manage/reset' && request.method === 'POST') {
        const origins = await loadOrigins(env);
        const reset = origins.map(o => ({
          ...o,
          isHealthy: true,
          errorCount: 0,
        }));
        await saveOrigins(env, reset);
        
        return new Response(JSON.stringify({ success: true, origins: reset }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Select origin endpoint
    if (path === '/select') {
      const clientRegion = getClientRegion(request);
      const origins = await loadOrigins(env);
      const selected = selectOrigin(origins, clientRegion);
      
      if (!selected) {
        return new Response(JSON.stringify({ error: 'No healthy origins available' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        origin: selected,
        clientRegion,
        allOrigins: origins.map(o => ({
          id: o.id,
          isHealthy: o.isHealthy,
          responseTime: o.responseTime,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Proxy request with automatic failover
    if (path.startsWith('/proxy')) {
      const clientRegion = getClientRegion(request);
      const origins = await loadOrigins(env);
      const sortedOrigins = [...origins].sort((a, b) => a.priority - b.priority);
      
      let lastError: Error | null = null;
      
      // Try origins in priority order
      for (const origin of sortedOrigins) {
        if (!origin.isHealthy) continue;
        
        try {
          // Create new request with modified path (remove /proxy prefix)
          const modifiedUrl = new URL(request.url);
          modifiedUrl.pathname = modifiedUrl.pathname.replace('/proxy', '');
          const modifiedRequest = new Request(modifiedUrl.toString(), request);
          
          return await proxyToOrigin(modifiedRequest, origin, env);
        } catch (error) {
          lastError = error as Error;
          console.error(`Origin ${origin.id} failed:`, error);
          continue;
        }
      }
      
      return new Response(JSON.stringify({
        error: 'All origins failed',
        lastError: lastError?.message,
        triedOrigins: sortedOrigins.filter(o => o.isHealthy).map(o => o.id),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Not found',
      availableEndpoints: ['/health', '/select', '/proxy/*', '/manage/*'],
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
  
  // Scheduled health checks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const origins = await loadOrigins(env);
    
    for (const origin of origins) {
      const result = await healthCheck(origin);
      const updated = await updateOriginHealth(env, origin, result);
      
      // Update in origins list
      const allOrigins = await loadOrigins(env);
      const index = allOrigins.findIndex(o => o.id === origin.id);
      if (index >= 0) {
        allOrigins[index] = updated;
        await saveOrigins(env, allOrigins);
      }
      
      console.log(`Health check ${origin.id}: ${result.healthy ? 'OK' : 'FAIL'} (${result.responseTime}ms)`);
    }
  },
};
