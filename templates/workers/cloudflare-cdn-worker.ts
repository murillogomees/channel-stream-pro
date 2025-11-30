/**
 * Cloudflare CDN Worker Template
 * 
 * JWT Validator + Token Strip + Cache-Key Normalization
 * 
 * Environment Variables Required:
 * - JWT_SECRET (HMAC secret for JWT validation)
 * - R2_BUCKET (R2 bucket binding)
 * - ALLOWED_ORIGINS (comma-separated list)
 */

// Types
interface JWTPayload {
  sub: string;          // User ID
  exp: number;          // Expiration timestamp
  iat: number;          // Issued at
  aud?: string;         // Audience
  r2_key?: string;      // Allowed R2 key pattern
  ip?: string;          // IP restriction
  max_uses?: number;    // Max usage count
  jti?: string;         // Token ID for tracking
}

interface CacheConfig {
  browserTTL: number;   // Browser cache TTL in seconds
  edgeTTL: number;      // Edge cache TTL in seconds
  bypassCache: boolean; // Skip cache entirely
}

// Constants
const CACHE_CONTROL_LIVE = 'public, max-age=2, s-maxage=2';
const CACHE_CONTROL_VOD = 'public, max-age=86400, s-maxage=604800'; // 1 day browser, 7 days edge
const CACHE_CONTROL_MANIFEST = 'public, max-age=2, s-maxage=10';
const CACHE_CONTROL_SEGMENT = 'public, max-age=31536000, s-maxage=31536000, immutable';

// JWT Verification
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    // Decode payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('[JWT] Token expired');
      return null;
    }

    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(data)
    );

    return valid ? payload : null;
  } catch (error) {
    console.error('[JWT] Verification error:', error);
    return null;
  }
}

// Extract token from request
function extractToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try query parameter
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token') || url.searchParams.get('t');
  if (queryToken) {
    return queryToken;
  }

  // Try cookie
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/(?:^|;\s*)stream_token=([^;]+)/);
  if (match) {
    return match[1];
  }

  return null;
}

// Normalize cache key (strip query params, normalize path)
function normalizeCacheKey(url: URL): string {
  // Remove auth-related query params
  const cleanUrl = new URL(url.toString());
  cleanUrl.searchParams.delete('token');
  cleanUrl.searchParams.delete('t');
  cleanUrl.searchParams.delete('sig');
  cleanUrl.searchParams.delete('expires');
  
  // Normalize path (lowercase, remove trailing slash)
  let path = cleanUrl.pathname.toLowerCase();
  if (path.endsWith('/') && path !== '/') {
    path = path.slice(0, -1);
  }
  cleanUrl.pathname = path;

  return cleanUrl.toString();
}

// Determine cache configuration based on content type
function getCacheConfig(path: string, isLive: boolean = false): CacheConfig {
  const lowerPath = path.toLowerCase();

  // Live streams - minimal caching
  if (isLive || lowerPath.includes('/live/')) {
    return {
      browserTTL: 2,
      edgeTTL: 2,
      bypassCache: false,
    };
  }

  // HLS manifests - short cache
  if (lowerPath.endsWith('.m3u8')) {
    return {
      browserTTL: 2,
      edgeTTL: 10,
      bypassCache: false,
    };
  }

  // HLS/DASH segments - long cache (immutable)
  if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.m4s') || lowerPath.endsWith('.mp4')) {
    return {
      browserTTL: 31536000,
      edgeTTL: 31536000,
      bypassCache: false,
    };
  }

  // Default - moderate caching
  return {
    browserTTL: 3600,
    edgeTTL: 86400,
    bypassCache: false,
  };
}

// Validate request against JWT claims
function validateRequest(
  request: Request,
  payload: JWTPayload,
  r2Key: string
): { valid: boolean; error?: string } {
  // Check IP restriction
  if (payload.ip) {
    const clientIP = request.headers.get('CF-Connecting-IP') || '';
    if (clientIP !== payload.ip) {
      return { valid: false, error: 'IP mismatch' };
    }
  }

  // Check R2 key pattern
  if (payload.r2_key) {
    const pattern = new RegExp(payload.r2_key);
    if (!pattern.test(r2Key)) {
      return { valid: false, error: 'Resource not allowed' };
    }
  }

  return { valid: true };
}

// Main handler
export default {
  async fetch(request: Request, env: Record<string, any>): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Range',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow GET and HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Extract R2 key from path
    const r2Key = url.pathname.slice(1); // Remove leading slash
    if (!r2Key) {
      return new Response('Not found', { status: 404 });
    }

    // Check if authentication is required
    const requiresAuth = !url.pathname.includes('/public/');

    if (requiresAuth) {
      // Extract and verify JWT
      const token = extractToken(request);
      if (!token) {
        return new Response('Unauthorized - No token provided', { status: 401 });
      }

      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (!payload) {
        return new Response('Unauthorized - Invalid token', { status: 401 });
      }

      // Validate request against JWT claims
      const validation = validateRequest(request, payload, r2Key);
      if (!validation.valid) {
        return new Response(`Forbidden - ${validation.error}`, { status: 403 });
      }
    }

    // Normalize cache key
    const cacheKey = normalizeCacheKey(url);
    const cache = caches.default;

    // Try cache first
    let response = await cache.match(cacheKey);
    if (response) {
      // Add cache hit header
      response = new Response(response.body, response);
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // Fetch from R2
    try {
      const object = await env.R2_BUCKET.get(r2Key, {
        range: request.headers.get('Range') || undefined,
      });

      if (!object) {
        return new Response('Not found', { status: 404 });
      }

      // Determine cache config
      const isLive = url.searchParams.get('live') === 'true';
      const cacheConfig = getCacheConfig(r2Key, isLive);

      // Build response headers
      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('ETag', object.httpEtag);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('X-Cache', 'MISS');

      // CORS
      headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGINS || '*');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

      // Cache control
      if (cacheConfig.bypassCache) {
        headers.set('Cache-Control', 'no-store');
      } else {
        headers.set('Cache-Control', `public, max-age=${cacheConfig.browserTTL}, s-maxage=${cacheConfig.edgeTTL}`);
      }

      // Content length
      if (object.size) {
        headers.set('Content-Length', object.size.toString());
      }

      // Handle range requests
      let status = 200;
      let body = object.body;

      if (object.range) {
        status = 206;
        const { offset, length } = object.range as { offset: number; length: number };
        headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
        headers.set('Content-Length', length.toString());
      }

      response = new Response(body, { status, headers });

      // Cache the response (if cacheable)
      if (!cacheConfig.bypassCache && request.method === 'GET') {
        // Clone response for caching
        const cacheResponse = response.clone();
        // Don't await - cache asynchronously
        cache.put(cacheKey, cacheResponse);
      }

      return response;
    } catch (error) {
      console.error('[CDN Worker] Error fetching from R2:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
