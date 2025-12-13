/**
 * Rate Limiter Worker - Distributed rate limiting for IPTV infrastructure
 * Uses Cloudflare KV for global rate limit tracking with token bucket algorithm
 * 
 * Endpoints:
 * - Manifest requests: 500 req/s per IP
 * - Segment requests: 1000 req/s per IP  
 * - API requests: 100 req/s per IP
 */

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  BLOCKED_IPS_KV: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WORKER_SECRET: string;
}

interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
  burstLimit: number;
}

interface RateLimitState {
  tokens: number;
  lastRefill: number;
  requestCount: number;
}

// Rate limit configurations by endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  manifest: { limit: 500, window: 1, burstLimit: 100 },
  segment: { limit: 1000, window: 1, burstLimit: 200 },
  api: { limit: 100, window: 1, burstLimit: 20 },
  auth: { limit: 10, window: 60, burstLimit: 5 },
  default: { limit: 200, window: 1, burstLimit: 50 },
};

// Classify request type based on path
function classifyRequest(path: string): string {
  if (path.includes('.m3u8') || path.includes('/manifest')) return 'manifest';
  if (path.includes('.ts') || path.includes('.m4s') || path.includes('/segment')) return 'segment';
  if (path.includes('/auth') || path.includes('/login')) return 'auth';
  if (path.includes('/api/') || path.includes('/functions/')) return 'api';
  return 'default';
}

// Get client identifier (IP or custom header)
function getClientId(request: Request): string {
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  const xRealIp = request.headers.get('X-Real-IP');
  
  return cfConnectingIp || xForwardedFor?.split(',')[0]?.trim() || xRealIp || 'unknown';
}

// Token bucket rate limiting with KV persistence
async function checkRateLimit(
  env: Env,
  clientId: string,
  requestType: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  const config = RATE_LIMITS[requestType] || RATE_LIMITS.default;
  const key = `rate:${requestType}:${clientId}`;
  const now = Date.now();
  
  // Get current state from KV
  const stateJson = await env.RATE_LIMIT_KV.get(key);
  let state: RateLimitState;
  
  if (stateJson) {
    state = JSON.parse(stateJson);
    
    // Refill tokens based on time elapsed
    const elapsed = (now - state.lastRefill) / 1000;
    const refillAmount = elapsed * (config.limit / config.window);
    state.tokens = Math.min(config.limit, state.tokens + refillAmount);
    state.lastRefill = now;
  } else {
    // Initialize new bucket
    state = {
      tokens: config.limit,
      lastRefill: now,
      requestCount: 0,
    };
  }
  
  // Check if request is allowed
  if (state.tokens >= 1) {
    state.tokens -= 1;
    state.requestCount += 1;
    
    // Persist state with short TTL
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(state), {
      expirationTtl: config.window * 10,
    });
    
    return {
      allowed: true,
      remaining: Math.floor(state.tokens),
      resetAt: now + (config.window * 1000),
    };
  }
  
  // Calculate retry-after
  const tokensNeeded = 1 - state.tokens;
  const refillRate = config.limit / config.window;
  const retryAfter = Math.ceil(tokensNeeded / refillRate);
  
  // Persist state
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(state), {
    expirationTtl: config.window * 10,
  });
  
  return {
    allowed: false,
    remaining: 0,
    resetAt: now + (retryAfter * 1000),
    retryAfter,
  };
}

// Check if IP is blocked
async function isBlocked(env: Env, clientId: string): Promise<boolean> {
  const blocked = await env.BLOCKED_IPS_KV.get(`blocked:${clientId}`);
  return blocked !== null;
}

// Block an IP for abuse
async function blockIp(env: Env, clientId: string, reason: string, durationSeconds: number = 3600): Promise<void> {
  await env.BLOCKED_IPS_KV.put(
    `blocked:${clientId}`,
    JSON.stringify({ reason, blockedAt: Date.now() }),
    { expirationTtl: durationSeconds }
  );
  
  // Also sync to Supabase ip_blacklist
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/ip_blacklist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        ip_address: clientId,
        reason,
        blocked_until: new Date(Date.now() + durationSeconds * 1000).toISOString(),
        is_permanent: false,
      }),
    });
  } catch (e) {
    console.error('Failed to sync block to Supabase:', e);
  }
}

// Unblock an IP
async function unblockIp(env: Env, clientId: string): Promise<void> {
  await env.BLOCKED_IPS_KV.delete(`blocked:${clientId}`);
}

// Get rate limit stats for monitoring
async function getStats(env: Env, clientId?: string): Promise<Record<string, any>> {
  const stats: Record<string, any> = {
    timestamp: new Date().toISOString(),
    rateLimits: RATE_LIMITS,
  };
  
  if (clientId) {
    const keys = Object.keys(RATE_LIMITS);
    stats.clientStats = {};
    
    for (const type of keys) {
      const stateJson = await env.RATE_LIMIT_KV.get(`rate:${type}:${clientId}`);
      if (stateJson) {
        stats.clientStats[type] = JSON.parse(stateJson);
      }
    }
    
    stats.isBlocked = await isBlocked(env, clientId);
  }
  
  return stats;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'rate-limiter-worker',
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const clientId = getClientId(request);
    
    // Management endpoints (require secret)
    if (path.startsWith('/manage')) {
      const secret = request.headers.get('X-Worker-Secret');
      if (secret !== env.WORKER_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/manage/stats') {
        const targetIp = url.searchParams.get('ip');
        const stats = await getStats(env, targetIp || undefined);
        return new Response(JSON.stringify(stats), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/manage/block' && request.method === 'POST') {
        const body = await request.json() as { ip: string; reason: string; duration?: number };
        await blockIp(env, body.ip, body.reason, body.duration);
        return new Response(JSON.stringify({ success: true, blocked: body.ip }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (path === '/manage/unblock' && request.method === 'POST') {
        const body = await request.json() as { ip: string };
        await unblockIp(env, body.ip);
        return new Response(JSON.stringify({ success: true, unblocked: body.ip }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Check if IP is blocked first
    if (await isBlocked(env, clientId)) {
      return new Response(JSON.stringify({
        error: 'Access denied',
        code: 'IP_BLOCKED',
        message: 'Your IP has been temporarily blocked due to abuse',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Rate limit check for /check endpoint
    if (path === '/check') {
      const targetPath = url.searchParams.get('path') || '/';
      const requestType = classifyRequest(targetPath);
      const result = await checkRateLimit(env, clientId, requestType);
      
      const headers = new Headers({
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(RATE_LIMITS[requestType]?.limit || RATE_LIMITS.default.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      });
      
      if (!result.allowed && result.retryAfter) {
        headers.set('Retry-After', String(result.retryAfter));
      }
      
      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          remaining: result.remaining,
          resetAt: result.resetAt,
          retryAfter: result.retryAfter,
        }), {
          status: 429,
          headers,
        });
      }
      
      return new Response(JSON.stringify({
        allowed: true,
        remaining: result.remaining,
        resetAt: result.resetAt,
        requestType,
        clientId,
      }), { headers });
    }
    
    // Default: pass through with rate limit check
    const requestType = classifyRequest(path);
    const result = await checkRateLimit(env, clientId, requestType);
    
    const headers = new Headers({
      ...corsHeaders,
      'X-RateLimit-Limit': String(RATE_LIMITS[requestType]?.limit || RATE_LIMITS.default.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetAt),
    });
    
    if (!result.allowed) {
      // Track abuse - if consistently hitting limits, block
      const abuseKey = `abuse:${clientId}`;
      const abuseCount = parseInt(await env.RATE_LIMIT_KV.get(abuseKey) || '0') + 1;
      await env.RATE_LIMIT_KV.put(abuseKey, String(abuseCount), { expirationTtl: 300 });
      
      if (abuseCount > 50) {
        await blockIp(env, clientId, 'Repeated rate limit violations', 3600);
      }
      
      headers.set('Retry-After', String(result.retryAfter));
      headers.set('Content-Type', 'application/json');
      
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        remaining: result.remaining,
        resetAt: result.resetAt,
        retryAfter: result.retryAfter,
      }), {
        status: 429,
        headers,
      });
    }
    
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({
      allowed: true,
      clientId,
      requestType,
      remaining: result.remaining,
    }), { headers });
  },
};
