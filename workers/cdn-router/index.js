/**
 * Cloudflare Worker - CDN Edge Router
 * 
 * Primary bucket: iptvlink-cdn
 * CDN base URL: https://cdn.iptvlink.app
 *
 * Deploy this to your Cloudflare account to handle:
 * 1. JWT validation on manifest requests
 * 2. Strip JWT from segment requests (normalize cache-key)
 * 3. Rate limiting + referrer checks
 * 4. Proper cache headers
 *
 * DEPLOY INSTRUCTIONS:
 * 1. Create a Cloudflare Worker in your dashboard
 * 2. Copy this code to the worker
 * 3. Set environment variables:
 *    - JWT_SECRET: Your signing secret (same as STREAM_PROXY_SECRET)
 *    - ALLOWED_REFERRERS: Comma-separated list of allowed domains
 *    - SUPABASE_URL: Your Supabase URL for rate limit DB calls
 *    - SUPABASE_ANON_KEY: Your Supabase anon key
 * 4. Bind to your R2 bucket as "R2_BUCKET" (bucket: iptvlink-cdn)
 * 5. Create a route for your CDN domain (cdn.iptvlink.app)
 */

// ============================================
// R2 CONFIGURATION (synced with r2-config.ts)
// ============================================

const R2_CONFIG = {
  BUCKET_NAME: 'iptvlink-cdn',
  CDN_BASE_URL: 'https://cdn.iptvlink.app',
  KEY_PREFIX: 'iptvlink',
  ENVIRONMENT: 'production',
};

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: 200,
  RATE_LIMIT_BANDWIDTH_MB_PER_MINUTE: 500,

  // Aggressive cache settings for HLS optimization (synced with r2-config.ts)
  MANIFEST_MAX_AGE: 10, // 10s browser cache
  MANIFEST_STALE_WHILE_REVALIDATE: 30, // 30s stale grace period
  MANIFEST_CDN_MAX_AGE: 30, // 30s CDN cache

  SEGMENT_MAX_AGE: 3600, // 1h browser cache
  SEGMENT_CDN_MAX_AGE: 86400, // 24h CDN cache
  SEGMENT_IMMUTABLE: true, // Enable immutable flag

  // Security
  ALLOWED_REFERRERS: ['iptvlink.app', 'iptvlink.com', 'localhost', '127.0.0.1'],
  ENABLE_CORS: true,
  ENABLE_CSP: true,

  // Performance
  ENABLE_BROTLI: true,
  ENABLE_GZIP: true,
  
  // Prewarm bot bypass - allows internal prewarm requests without JWT
  PREWARM_BOT_USER_AGENT: 'CDN-Prewarm-Bot/1.0',
};

// ============================================
// MIME TYPES (synced with r2-config.ts)
// ============================================

const MIME_TYPES = {
  'm3u8': 'application/vnd.apple.mpegurl',
  'ts': 'video/mp2t',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mkv': 'video/x-matroska',
  'mp3': 'audio/mpeg',
  'aac': 'audio/aac',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'm3u': 'audio/x-mpegurl',
  'json': 'application/json',
  'txt': 'text/plain',
};

function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ============================================
// JWT UTILITIES
// ============================================

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = `${headerB64}.${payloadB64}`;
    let signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (signatureStr.length % 4) signatureStr += '=';
    const signatureBytes = Uint8Array.from(atob(signatureStr), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(data));

    if (!valid) return null;

    const payloadJson = base64UrlDecode(payloadB64);
    return JSON.parse(payloadJson);
  } catch (e) {
    console.error('JWT verification failed:', e);
    return null;
  }
}

// ============================================
// CONTENT DETECTION
// ============================================

function isManifest(url) {
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith('.m3u8') ||
    path.endsWith('.m3u') ||
    path.includes('/manifest') ||
    path.includes('master.m3u8') ||
    path.includes('index.m3u8')
  );
}

function isSegment(url) {
  const path = url.pathname.toLowerCase();
  return path.endsWith('.ts') || path.endsWith('.m4s') || path.endsWith('.mp4') || path.includes('/segment');
}

function getContentCategory(url) {
  if (isManifest(url)) return 'manifest';
  if (isSegment(url)) return 'segment';
  return 'other';
}

// ============================================
// SECURITY HEADERS
// ============================================

function getSecurityHeaders(request, allowedDomains) {
  const headers = new Headers();

  if (CONFIG.ENABLE_CORS) {
    const origin = request.headers.get('Origin') || '*';
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }

  if (CONFIG.ENABLE_CSP) {
    const domains = allowedDomains.join(' ');
    headers.set('Content-Security-Policy', `default-src 'self' ${domains}; media-src 'self' ${domains} blob:;`);
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');

  return headers;
}

function checkReferrer(request, allowedReferrers) {
  const referrer = request.headers.get('Referer') || request.headers.get('Origin');

  if (!referrer) {
    return true;
  }

  try {
    const referrerUrl = new URL(referrer);
    return allowedReferrers.some(
      (domain) => referrerUrl.hostname === domain || referrerUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map();

function checkRateLimit(identifier, requestSize = 0) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;
  const key = `${identifier}:${windowStart}`;

  let record = rateLimitMap.get(key);
  if (!record) {
    record = { requests: 0, bandwidth: 0 };
    rateLimitMap.set(key, record);

    for (const [k] of rateLimitMap) {
      if (!k.endsWith(`:${windowStart}`)) {
        rateLimitMap.delete(k);
      }
    }
  }

  record.requests++;
  record.bandwidth += requestSize;

  if (record.requests > CONFIG.RATE_LIMIT_REQUESTS_PER_MINUTE) {
    return { allowed: false, reason: 'Too many requests' };
  }

  if (record.bandwidth > CONFIG.RATE_LIMIT_BANDWIDTH_MB_PER_MINUTE * 1024 * 1024) {
    return { allowed: false, reason: 'Bandwidth limit exceeded' };
  }

  return { allowed: true };
}

// ============================================
// MAIN HANDLER
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          r2: {
            bucket: R2_CONFIG.BUCKET_NAME,
            cdnBaseUrl: R2_CONFIG.CDN_BASE_URL,
            keyPrefix: R2_CONFIG.KEY_PREFIX,
          },
          config: {
            rateLimit: `${CONFIG.RATE_LIMIT_REQUESTS_PER_MINUTE} req/min`,
            bandwidth: `${CONFIG.RATE_LIMIT_BANDWIDTH_MB_PER_MINUTE} MB/min`,
            manifestCache: `${CONFIG.MANIFEST_MAX_AGE}s browser, ${CONFIG.MANIFEST_CDN_MAX_AGE}s edge`,
            segmentCache: `${CONFIG.SEGMENT_MAX_AGE}s browser, ${CONFIG.SEGMENT_CDN_MAX_AGE}s edge`,
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    // Handle OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getSecurityHeaders(request, CONFIG.ALLOWED_REFERRERS),
      });
    }

    // Only handle GET/HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const clientIP =
      request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0] || 'unknown';

    const allowedReferrers = env.ALLOWED_REFERRERS
      ? env.ALLOWED_REFERRERS.split(',').map((s) => s.trim())
      : CONFIG.ALLOWED_REFERRERS;

    if (!checkReferrer(request, allowedReferrers)) {
      return new Response('Forbidden: Invalid referrer', { status: 403 });
    }

    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return new Response(`Rate limit exceeded: ${rateLimitResult.reason}`, {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }

    const contentCategory = getContentCategory(url);
    const jwtToken = url.searchParams.get('jwt');
    const userAgent = request.headers.get('User-Agent') || '';
    
    // Check if this is a prewarm bot request (internal service)
    const isPrewarmBot = userAgent.includes(CONFIG.PREWARM_BOT_USER_AGENT);

    // ========================================
    // MANIFEST HANDLING (JWT REQUIRED - except for prewarm bot)
    // ========================================
    if (contentCategory === 'manifest') {
      // Prewarm bot bypass - allow without JWT for cache warming
      if (isPrewarmBot) {
        console.log('[CDN] Prewarm bot access for manifest:', url.pathname);
        const r2Key = url.pathname.replace(/^[/]/, '');
        const object = await env.R2_BUCKET.get(r2Key);
        
        if (!object) {
          return new Response('Not found', { status: 404 });
        }
        
        const headers = getSecurityHeaders(request, allowedReferrers);
        headers.set('Content-Type', getMimeType(r2Key));
        headers.set('Cache-Control', `public, max-age=${CONFIG.MANIFEST_MAX_AGE}, s-maxage=${CONFIG.MANIFEST_CDN_MAX_AGE}`);
        headers.set('X-Prewarm', 'true');
        
        return new Response(object.body, { headers });
      }
      
      if (!jwtToken) {
        return new Response('Unauthorized: JWT required for manifests', { status: 401 });
      }

      const jwtSecret = env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET not configured');
        return new Response('Server configuration error', { status: 500 });
      }

      const payload = await verifyJWT(jwtToken, jwtSecret);
      if (!payload) {
        return new Response('Unauthorized: Invalid JWT', { status: 401 });
      }

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return new Response('Unauthorized: Token expired', { status: 401 });
      }

      if (payload.ip && payload.ip !== clientIP) {
        return new Response('Forbidden: IP mismatch', { status: 403 });
      }

      const r2Key = url.pathname.replace(/^[/]/, '');
      const object = await env.R2_BUCKET.get(r2Key);

      if (!object) {
        return new Response('Not found', { status: 404 });
      }

      const headers = getSecurityHeaders(request, allowedReferrers);
      headers.set('Content-Type', getMimeType(r2Key));

      headers.set(
        'Cache-Control',
        `public, max-age=${CONFIG.MANIFEST_MAX_AGE}, s-maxage=${CONFIG.MANIFEST_CDN_MAX_AGE}, stale-while-revalidate=${CONFIG.MANIFEST_STALE_WHILE_REVALIDATE}`
      );
      headers.set('CDN-Cache-Control', `max-age=${CONFIG.MANIFEST_CDN_MAX_AGE}`);
      headers.set('Vary', 'Accept-Encoding');

      if (payload.exp) {
        headers.set('X-Token-Expires', new Date(payload.exp * 1000).toISOString());
      }

      return new Response(object.body, { headers });
    }

    // ========================================
    // SEGMENT HANDLING (STRIP JWT, NORMALIZE CACHE KEY)
    // ========================================
    if (contentCategory === 'segment') {
      const normalizedUrl = new URL(url);
      normalizedUrl.searchParams.delete('jwt');

      const r2Key = normalizedUrl.pathname.replace(/^[/]/, '');

      const cacheKey = new Request(normalizedUrl.toString());
      const cache = caches.default;

      let response = await cache.match(cacheKey);

      if (!response) {
        const object = await env.R2_BUCKET.get(r2Key);

        if (!object) {
          return new Response('Not found', { status: 404 });
        }

        const headers = getSecurityHeaders(request, allowedReferrers);
        headers.set('Content-Type', object.httpMetadata?.contentType || getMimeType(r2Key));

        const cacheDirectives = [
          'public',
          `max-age=${CONFIG.SEGMENT_MAX_AGE}`,
          `s-maxage=${CONFIG.SEGMENT_CDN_MAX_AGE}`,
        ];

        if (CONFIG.SEGMENT_IMMUTABLE) {
          cacheDirectives.push('immutable');
        }

        headers.set('Cache-Control', cacheDirectives.join(', '));
        headers.set('CDN-Cache-Control', `max-age=${CONFIG.SEGMENT_CDN_MAX_AGE}`);
        headers.set('Accept-Ranges', 'bytes');

        response = new Response(object.body, { headers });

        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    }

    // ========================================
    // OTHER CONTENT
    // ========================================
    const r2Key = url.pathname.replace(/^[/]/, '');
    const object = await env.R2_BUCKET.get(r2Key);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    const headers = getSecurityHeaders(request, allowedReferrers);
    headers.set('Content-Type', object.httpMetadata?.contentType || getMimeType(r2Key));
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(object.body, { headers });
  },
};
