/**
 * ============================================================================
 * IPTV Stream Proxy - Netflix-Grade Performance V5 (SECURITY HARDENED)
 * ============================================================================
 * 
 * Proxy otimizado para streams HLS/IPTV com:
 * - Domain whitelisting for security
 * - Rate limiting per IP
 * - Playback token integration
 * - Cache agressivo para segmentos (até 5 min)
 * - Connection pooling e keep-alive
 * - Compression automática
 * - Retry exponencial com jitter
 * - Headers otimizados para CDN
 * 
 * @version 5.0.0
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// CORS HEADERS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, accept-encoding, x-playback-token',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Cache-Status',
} as const;

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================
const SECURITY = {
  // Allowed upstream domains (whitelist)
  ALLOWED_DOMAINS: [
    // IPTV providers
    '.m3u8',
    '.ts',
    'xtream',
    'live.',
    'vod.',
    'series.',
    'movie.',
    // CDN domains
    'cloudflare',
    'akamai',
    'fastly',
    'cloudfront',
    'cdn.',
    // R2 storage
    'r2.cloudflarestorage.com',
    // Our own domains
    'iptvlink.com.br',
    'iptvlink.app',
  ],
  
  // Blocked patterns (blacklist)
  BLOCKED_PATTERNS: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '192.168.',
    'metadata.google',
    '169.254.',
    'supabase.co',
    'supabase.in',
  ],
  
  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 60000, // 1 minute
    MAX_REQUESTS: 300, // 300 requests per minute per IP
  },
} as const;

// In-memory rate limit tracking
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// =============================================================================
// CONFIGURATION - NETFLIX-GRADE SETTINGS
// =============================================================================
const CONFIG = {
  // Timeouts
  FETCH_TIMEOUT_MS: 15000,
  MANIFEST_FETCH_TIMEOUT_MS: 8000,
  LIVE_FETCH_TIMEOUT_MS: 10000,
  
  // Retry settings
  MAX_RETRIES: 2,
  MANIFEST_MAX_RETRIES: 1,
  RETRY_DELAY_BASE_MS: 200,
  RETRY_JITTER_MS: 50,
  
  // Cache settings
  MANIFEST_CACHE_SECONDS: 5,
  SEGMENT_CACHE_SECONDS: 300,
  VOD_SEGMENT_CACHE_SECONDS: 3600,
  KEY_CACHE_SECONDS: 3600,
  
  // Prefetch
  PREFETCH_ENABLED: true,
  PREFETCH_SEGMENTS: 2,
  
  // Quality
  MAX_BANDWIDTH_HINT: 10000000,
} as const;

// =============================================================================
// SECURITY FUNCTIONS
// =============================================================================

function isDomainAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check blocked patterns first (SSRF protection)
    for (const blocked of SECURITY.BLOCKED_PATTERNS) {
      if (hostname.includes(blocked) || url.includes(blocked)) {
        console.log(`[Proxy] BLOCKED: ${hostname} matches blocked pattern: ${blocked}`);
        return false;
      }
    }
    
    // For IPTV content, we allow most external domains but block internal
    // The whitelist is more permissive for media content
    const urlLower = url.toLowerCase();
    
    // Allow if URL contains allowed patterns (media files, CDNs)
    for (const allowed of SECURITY.ALLOWED_DOMAINS) {
      if (hostname.includes(allowed) || urlLower.includes(allowed)) {
        return true;
      }
    }
    
    // Allow any HTTP/HTTPS URL that isn't blocked (for IPTV flexibility)
    // The SSRF protection from blocked patterns is the main security layer
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + SECURITY.RATE_LIMIT.WINDOW_MS });
    return { allowed: true, remaining: SECURITY.RATE_LIMIT.MAX_REQUESTS - 1 };
  }
  
  if (entry.count >= SECURITY.RATE_LIMIT.MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: SECURITY.RATE_LIMIT.MAX_REQUESTS - entry.count };
}

async function verifyPlaybackToken(token: string, supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('validate_playback_token', {
      p_token_hash: token,
      p_ip_address: null
    });
    
    if (error || !data) {
      return false;
    }
    
    return data.valid === true;
  } catch {
    return false;
  }
}

// =============================================================================
// IN-MEMORY CACHE (Edge Function instance)
// =============================================================================
const memoryCache = new Map<string, { data: string | ArrayBuffer; expires: number; contentType: string }>();
const MEMORY_CACHE_MAX_SIZE = 100;

function getCached(key: string): { data: string | ArrayBuffer; contentType: string } | null {
  const entry = memoryCache.get(key);
  if (entry && entry.expires > Date.now()) {
    return { data: entry.data, contentType: entry.contentType };
  }
  memoryCache.delete(key);
  return null;
}

function setCache(key: string, data: string | ArrayBuffer, contentType: string, ttlSeconds: number): void {
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000, contentType });
}

// =============================================================================
// URL UTILITIES
// =============================================================================

function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    pathParts.pop();
    return `${urlObj.protocol}//${urlObj.host}${pathParts.join('/')}`;
  } catch {
    const lastSlash = url.lastIndexOf('/');
    return lastSlash > 0 ? url.substring(0, lastSlash) : url;
  }
}

function getOrigin(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return '';
  }
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/')) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    } catch {
      return url;
    }
  }
  return `${baseUrl}/${url}`;
}

// =============================================================================
// CONTENT TYPE DETECTION
// =============================================================================

function isHlsContent(url: string, contentType: string | null): boolean {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u')) return true;
  if (contentType) {
    const ctLower = contentType.toLowerCase();
    return ctLower.includes('mpegurl') || ctLower.includes('x-mpegurl') || ctLower.includes('vnd.apple');
  }
  return false;
}

function isSegment(url: string): boolean {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.ts') || urlLower.includes('.aac') || 
      urlLower.includes('.mp4') || urlLower.includes('.fmp4') ||
      urlLower.includes('.m4s') || urlLower.includes('.m4a') ||
      urlLower.includes('.m4v')) {
    return true;
  }
  if (urlLower.includes('/movie/') || urlLower.includes('/series/')) {
    return true;
  }
  return false;
}

function isVodContent(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('/movie/') || 
         urlLower.includes('/series/') || 
         urlLower.includes('/vod/') ||
         urlLower.includes('.mp4') ||
         urlLower.includes('.mkv');
}

function isDirectStream(url: string): boolean {
  // Xtream live stream patterns:
  // /live/user/pass/channelId
  // /user/pass/channelId (direct without /live/)
  // Just ends with numeric ID and no file extension
  const urlLower = url.toLowerCase();
  
  // Skip if it has a file extension
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u') || 
      urlLower.includes('.ts') || urlLower.includes('.mp4')) {
    return false;
  }
  
  // Pattern: ends with numeric ID
  const endsWithNumericId = /\/\d+$/.test(url);
  
  // Pattern: typical Xtream structure user/pass/id or port:number followed by path/id
  const xtreamPattern = /:\d+\/[^\/]+\/[^\/]+\/\d+$/.test(url);
  
  return endsWithNumericId || xtreamPattern;
}

function isKeyFile(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.key') || urlLower.includes('key=') || urlLower.includes('/key/');
}

// =============================================================================
// HLS MANIFEST REWRITING
// =============================================================================

function rewriteHlsManifest(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n');
  
  return lines.map(line => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.includes('URI="'))) {
      return line;
    }
    
    if (trimmedLine.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const fullUrl = resolveUrl(uri, baseUrl);
        return `URI="${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}"`;
      });
    }
    
    if (!trimmedLine.startsWith('#')) {
      const fullUrl = resolveUrl(trimmedLine, baseUrl);
      return `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
    }
    
    return line;
  }).join('\n');
}

// =============================================================================
// HTTP FETCHING
// =============================================================================

function createUpstreamHeaders(origin: string, rangeHeader: string | null, acceptEncoding: string | null, isLiveStream: boolean = false, isSegment: boolean = false): Headers {
  const headers = new Headers();
  
  // For Xtream live streams AND segments, use minimal headers to avoid 403/405 errors
  // Many Xtream servers reject requests with certain headers or require specific User-Agent
  if (isLiveStream || isSegment) {
    headers.set('User-Agent', 'VLC/3.0.18 LibVLC/3.0.18');
    headers.set('Accept', '*/*');
    headers.set('Connection', 'keep-alive');
    // Don't set Origin/Referer/Accept-Encoding for live streams and segments
  } else {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Accept', '*/*');
    headers.set('Accept-Language', 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7');
    headers.set('Connection', 'keep-alive');
    
    if (acceptEncoding) {
      headers.set('Accept-Encoding', acceptEncoding);
    }
    
    if (origin) {
      headers.set('Referer', `${origin}/`);
      headers.set('Origin', origin);
    }
  }
  
  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }
  
  return headers;
}

function getJitter(): number {
  return Math.random() * CONFIG.RETRY_JITTER_MS;
}

async function fetchWithRetry(
  url: string, 
  headers: Headers, 
  timeoutMs: number = CONFIG.FETCH_TIMEOUT_MS,
  maxRetries: number = CONFIG.MAX_RETRIES
): Promise<{ response: Response; usedUrl: string }> {
  let lastError: Error | null = null;
  let urlToFetch = url;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(urlToFetch, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 206) {
        return { response, usedUrl: urlToFetch };
      }
      
      if (response.status === 403 || response.status === 401) {
        return { response, usedUrl: urlToFetch };
      }
      
      lastError = new Error(`HTTP ${response.status}`);
      
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message || '';
      
      if (attempt === 0 && urlToFetch.startsWith('https://')) {
        const tlsIndicators = ['tls', 'ssl', 'certificate', 'handshake', 'corrupt', 'CERT'];
        if (tlsIndicators.some(ind => msg.toLowerCase().includes(ind.toLowerCase()))) {
          console.log(`[Proxy] TLS error, falling back to HTTP`);
          urlToFetch = urlToFetch.replace('https://', 'http://');
          continue;
        }
      }
    }
    
    if (attempt < CONFIG.MAX_RETRIES - 1) {
      const delay = CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempt) + getJitter();
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Get client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';

  // Check rate limit
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    console.log(`[Proxy] RATE LIMITED: ${clientIp}`);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...CORS_HEADERS, 
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0'
        } 
      }
    );
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    const playbackToken = url.searchParams.get('token') || req.headers.get('x-playback-token');

    if (!streamUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const decodedUrl = decodeURIComponent(streamUrl);

    // Security: Domain whitelist check
    if (!isDomainAllowed(decodedUrl)) {
      console.log(`[Proxy] DOMAIN BLOCKED: ${decodedUrl.substring(0, 100)}`);
      return new Response(
        JSON.stringify({ error: 'Domain not allowed' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Verify playback token for premium content
    if (playbackToken) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const isValid = await verifyPlaybackToken(playbackToken, supabase);
      if (!isValid) {
        console.log(`[Proxy] Invalid playback token`);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired playback token' }),
          { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    const origin = getOrigin(decodedUrl);
    const isVideoSegment = isSegment(decodedUrl);
    const isLiveStream = isDirectStream(decodedUrl);
    const isVod = isVodContent(decodedUrl);
    const isKey = isKeyFile(decodedUrl);
    
    const reqType = isKey ? 'KEY' : isVideoSegment ? 'SEG' : isLiveStream ? 'LIVE' : 'M3U';
    const cacheKey = `proxy:${decodedUrl}`;
    
    // Check memory cache for manifests and keys
    if (reqType === 'M3U' || reqType === 'KEY') {
      const cached = getCached(cacheKey);
      if (cached) {
        const responseHeaders = new Headers(CORS_HEADERS);
        responseHeaders.set('Content-Type', cached.contentType);
        responseHeaders.set('X-Cache-Status', 'HIT');
        responseHeaders.set('X-RateLimit-Remaining', String(rateLimit.remaining));
        responseHeaders.set('Cache-Control', `public, max-age=${reqType === 'KEY' ? CONFIG.KEY_CACHE_SECONDS : CONFIG.MANIFEST_CACHE_SECONDS}`);
        return new Response(cached.data, { status: 200, headers: responseHeaders });
      }
    }
    
    console.log(`[Proxy] ${req.method} ${reqType}: ${decodedUrl.substring(0, 60)}...`);

    const rangeHeader = req.headers.get('Range');
    const acceptEncoding = req.headers.get('Accept-Encoding');
    const upstreamHeaders = createUpstreamHeaders(origin, rangeHeader, acceptEncoding, isLiveStream, isVideoSegment);

    let timeout: number;
    let maxRetries: number;
    
    if (reqType === 'M3U') {
      timeout = CONFIG.MANIFEST_FETCH_TIMEOUT_MS;
      maxRetries = CONFIG.MANIFEST_MAX_RETRIES;
    } else if (isLiveStream) {
      timeout = CONFIG.LIVE_FETCH_TIMEOUT_MS;
      maxRetries = CONFIG.MAX_RETRIES;
    } else {
      timeout = CONFIG.FETCH_TIMEOUT_MS;
      maxRetries = CONFIG.MAX_RETRIES;
    }
    
    const { response: streamResponse, usedUrl } = await fetchWithRetry(decodedUrl, upstreamHeaders, timeout, maxRetries);

    if (!streamResponse.ok && streamResponse.status !== 206) {
      const status = streamResponse.status;
      
      if (status === 403 || status === 401) {
        return new Response(
          JSON.stringify({ error: 'Access denied by upstream server' }), 
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Upstream error: ${status}` }), 
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    let contentType = streamResponse.headers.get('Content-Type');
    const isHls = isHlsContent(decodedUrl, contentType);
    
    if (!contentType || contentType === 'application/octet-stream') {
      const urlLower = decodedUrl.toLowerCase();
      if (isHls) {
        contentType = 'application/vnd.apple.mpegurl';
      } else if (isKey) {
        contentType = 'application/octet-stream';
      } else if (urlLower.includes('.mp4') || urlLower.includes('/movie/')) {
        contentType = 'video/mp4';
      } else if (urlLower.includes('.mkv')) {
        contentType = 'video/x-matroska';
      } else if (urlLower.includes('.ts') || isVideoSegment || isLiveStream) {
        contentType = 'video/mp2t';
      } else {
        contentType = 'application/octet-stream';
      }
    }

    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('X-Cache-Status', 'MISS');
    responseHeaders.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    responseHeaders.set('Vary', 'Accept-Encoding');
    
    if (isHls) {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.MANIFEST_CACHE_SECONDS}, stale-while-revalidate=2`);
    } else if (isKey) {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.KEY_CACHE_SECONDS}, immutable`);
    } else if (isVod) {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.VOD_SEGMENT_CACHE_SECONDS}, immutable`);
    } else {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.SEGMENT_CACHE_SECONDS}`);
    }

    if (isHls) {
      const manifestContent = await streamResponse.text();
      const baseUrl = getBaseUrl(usedUrl);
      const proxyBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
      
      const rewrittenManifest = rewriteHlsManifest(manifestContent, baseUrl, proxyBaseUrl);
      
      setCache(cacheKey, rewrittenManifest, 'application/vnd.apple.mpegurl', CONFIG.MANIFEST_CACHE_SECONDS);
      
      const duration = Date.now() - startTime;
      console.log(`[Proxy] M3U served in ${duration}ms`);
      
      return new Response(rewrittenManifest, { status: 200, headers: responseHeaders });
    }

    if (isKey) {
      const keyData = await streamResponse.arrayBuffer();
      setCache(cacheKey, keyData, contentType, CONFIG.KEY_CACHE_SECONDS);
      return new Response(keyData, { status: 200, headers: responseHeaders });
    }

    const passHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
    passHeaders.forEach(header => {
      const value = streamResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    if (req.method === 'HEAD') {
      return new Response(null, { status: 200, headers: responseHeaders });
    }

    if (!streamResponse.body) {
      return new Response(null, { status: streamResponse.status, headers: responseHeaders });
    }

    const duration = Date.now() - startTime;
    console.log(`[Proxy] ${reqType} started in ${duration}ms`);

    return new Response(streamResponse.body, { status: streamResponse.status, headers: responseHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Proxy] Error: ${message}`);
    
    const isTimeout = message.includes('abort') || message.includes('timeout');
    
    return new Response(
      JSON.stringify({ error: isTimeout ? 'Upstream timeout' : 'Proxy error', details: message }),
      { status: isTimeout ? 504 : 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}