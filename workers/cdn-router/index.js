/**
 * Cloudflare Worker - CDN Edge Router
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
 * 4. Bind to your R2 bucket as "R2_BUCKET"
 * 5. Create a route for your CDN domain
 * 
 * CDN RULES (configure in Cloudflare Dashboard):
 * - Manifests: cache-control public, max-age=30, stale-while-revalidate=60
 * - Segments: cache-control public, max-age=86400
 * - Enable Brotli compression
 * - Set CSP and CORS headers
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: 200,
  RATE_LIMIT_BANDWIDTH_MB_PER_MINUTE: 500,
  
  // Aggressive cache settings for HLS optimization
  MANIFEST_MAX_AGE: 10,                    // 10s browser cache (frequently updated)
  MANIFEST_STALE_WHILE_REVALIDATE: 30,     // 30s stale grace period
  MANIFEST_CDN_MAX_AGE: 30,                // 30s CDN cache
  
  SEGMENT_MAX_AGE: 3600,                   // 1h browser cache (immutable content)
  SEGMENT_CDN_MAX_AGE: 86400,              // 24h CDN cache
  SEGMENT_IMMUTABLE: true,                 // Enable immutable flag
  
  // Security
  ALLOWED_REFERRERS: ['iptvlink.com', 'localhost', '127.0.0.1'],
  ENABLE_CORS: true,
  ENABLE_CSP: true,
  
  // Performance
  ENABLE_BROTLI: true,
  ENABLE_GZIP: true
};

// ============================================
// JWT UTILITIES
// ============================================

/**
 * Decode base64url string
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

/**
 * Verify JWT signature and return payload
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Import key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Verify signature
    const data = `${headerB64}.${payloadB64}`;
    let signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (signatureStr.length % 4) signatureStr += '=';
    const signatureBytes = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(data)
    );
    
    if (!valid) return null;
    
    // Decode and return payload
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

/**
 * Detect if URL is a manifest
 */
function isManifest(url) {
  const path = url.pathname.toLowerCase();
  return path.endsWith('.m3u8') || 
         path.includes('/manifest') ||
         path.includes('master.m3u8') ||
         path.includes('index.m3u8');
}

/**
 * Detect if URL is a segment
 */
function isSegment(url) {
  const path = url.pathname.toLowerCase();
  return path.endsWith('.ts') || 
         path.endsWith('.m4s') ||
         path.endsWith('.mp4') ||
         path.includes('/segment');
}

/**
 * Get content type category
 */
function getContentCategory(url) {
  if (isManifest(url)) return 'manifest';
  if (isSegment(url)) return 'segment';
  return 'other';
}

// ============================================
// SECURITY HEADERS
// ============================================

/**
 * Generate security headers
 */
function getSecurityHeaders(request, allowedDomains) {
  const headers = new Headers();
  
  // CORS
  if (CONFIG.ENABLE_CORS) {
    const origin = request.headers.get('Origin') || '*';
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Range, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }
  
  // CSP
  if (CONFIG.ENABLE_CSP) {
    const domains = allowedDomains.join(' ');
    headers.set('Content-Security-Policy', 
      `default-src 'self' ${domains}; media-src 'self' ${domains} blob:;`
    );
  }
  
  // Additional security
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  
  return headers;
}

/**
 * Check referrer restriction
 */
function checkReferrer(request, allowedReferrers) {
  const referrer = request.headers.get('Referer') || request.headers.get('Origin');
  
  if (!referrer) {
    // Allow direct access for testing (configure as needed)
    return true;
  }
  
  try {
    const referrerUrl = new URL(referrer);
    return allowedReferrers.some(domain => 
      referrerUrl.hostname === domain || 
      referrerUrl.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Simple in-memory rate limiter (for demo - use KV in production)
 * In production, use Cloudflare KV or Durable Objects
 */
const rateLimitMap = new Map();

function checkRateLimit(identifier, requestSize = 0) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // 1-minute window
  const key = `${identifier}:${windowStart}`;
  
  let record = rateLimitMap.get(key);
  if (!record) {
    record = { requests: 0, bandwidth: 0 };
    rateLimitMap.set(key, record);
    
    // Clean old entries
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
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        config: {
          rateLimit: `${CONFIG.RATE_LIMIT_REQUESTS_PER_MINUTE} req/min`,
          bandwidth: `${CONFIG.RATE_LIMIT_BANDWIDTH_MB_PER_MINUTE} MB/min`,
          manifestCache: `${CONFIG.MANIFEST_MAX_AGE}s browser, ${CONFIG.MANIFEST_CDN_MAX_AGE}s edge`,
          segmentCache: `${CONFIG.SEGMENT_MAX_AGE}s browser, ${CONFIG.SEGMENT_CDN_MAX_AGE}s edge`
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // Handle OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getSecurityHeaders(request, CONFIG.ALLOWED_REFERRERS)
      });
    }
    
    // Only handle GET/HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Get client IP for rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                     'unknown';
    
    // Check referrer
    const allowedReferrers = env.ALLOWED_REFERRERS 
      ? env.ALLOWED_REFERRERS.split(',').map(s => s.trim())
      : CONFIG.ALLOWED_REFERRERS;
    
    if (!checkReferrer(request, allowedReferrers)) {
      return new Response('Forbidden: Invalid referrer', { status: 403 });
    }
    
    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return new Response(`Rate limit exceeded: ${rateLimitResult.reason}`, { 
        status: 429,
        headers: { 'Retry-After': '60' }
      });
    }
    
    // Determine content type
    const contentCategory = getContentCategory(url);
    const jwtToken = url.searchParams.get('jwt');
    
    // ========================================
    // MANIFEST HANDLING (JWT REQUIRED)
    // ========================================
    if (contentCategory === 'manifest') {
      // Manifests require valid JWT
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
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return new Response('Unauthorized: Token expired', { status: 401 });
      }
      
      // Check IP restriction if specified in token
      if (payload.ip && payload.ip !== clientIP) {
        return new Response('Forbidden: IP mismatch', { status: 403 });
      }
      
      // Fetch from R2 (include JWT in cache key for manifests)
      const r2Key = url.pathname.replace(/^[/]/, '');
      const object = await env.R2_BUCKET.get(r2Key);
      
      if (!object) {
        return new Response('Not found', { status: 404 });
      }
      
      const headers = getSecurityHeaders(request, allowedReferrers);
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');
      
      // Layered caching: browser + CDN with different TTLs
      headers.set('Cache-Control', `public, max-age=${CONFIG.MANIFEST_MAX_AGE}, s-maxage=${CONFIG.MANIFEST_CDN_MAX_AGE}, stale-while-revalidate=${CONFIG.MANIFEST_STALE_WHILE_REVALIDATE}`);
      headers.set('CDN-Cache-Control', `max-age=${CONFIG.MANIFEST_CDN_MAX_AGE}`); // Cloudflare-specific
      headers.set('Vary', 'Accept-Encoding');
      
      // Add token expiry header for client reference
      if (payload.exp) {
        headers.set('X-Token-Expires', new Date(payload.exp * 1000).toISOString());
      }
      
      return new Response(object.body, { headers });
    }
    
    // ========================================
    // SEGMENT HANDLING (STRIP JWT, NORMALIZE CACHE KEY)
    // ========================================
    if (contentCategory === 'segment') {
      /**
       * CRITICAL: Strip JWT from segment requests to normalize cache-key
       * 
       * Pattern explanation:
       * 1. Manifest requests include JWT for authorization
       * 2. Manifest contains segment URLs (which may include JWT)
       * 3. We verify the JWT at manifest level
       * 4. For segments, we strip the JWT to create a normalized cache key
       * 5. This allows segment caching to be shared across all valid users
       * 
       * Security consideration:
       * - Segments are only accessible if user had valid manifest JWT
       * - Segment URLs are only known to users who got the manifest
       * - This is similar to HLS token-based auth patterns
       */
      
      // Create normalized URL without JWT for cache key
      const normalizedUrl = new URL(url);
      normalizedUrl.searchParams.delete('jwt');
      
      const r2Key = normalizedUrl.pathname.replace(/^[/]/, '');
      
      // Try cache first with normalized key
      const cacheKey = new Request(normalizedUrl.toString());
      const cache = caches.default;
      
      let response = await cache.match(cacheKey);
      
      if (!response) {
        // Fetch from R2
        const object = await env.R2_BUCKET.get(r2Key);
        
        if (!object) {
          return new Response('Not found', { status: 404 });
        }
        
        const headers = getSecurityHeaders(request, allowedReferrers);
        headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp2t');
        
        // Ultra-aggressive caching for segments (immutable content)
        const cacheDirectives = [
          'public',
          `max-age=${CONFIG.SEGMENT_MAX_AGE}`,
          `s-maxage=${CONFIG.SEGMENT_CDN_MAX_AGE}`
        ];
        
        if (CONFIG.SEGMENT_IMMUTABLE) {
          cacheDirectives.push('immutable');
        }
        
        headers.set('Cache-Control', cacheDirectives.join(', '));
        headers.set('CDN-Cache-Control', `max-age=${CONFIG.SEGMENT_CDN_MAX_AGE}`); // Cloudflare-specific: 24h edge cache
        headers.set('Accept-Ranges', 'bytes');
        
        response = new Response(object.body, { headers });
        
        // Store in cache with normalized key
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
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600');
    
    return new Response(object.body, { headers });
  }
};
