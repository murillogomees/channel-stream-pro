/**
 * ============================================================================
 * IPTV Stream Proxy - Enterprise Grade V6
 * ============================================================================
 * 
 * Proxy para streams HLS/IPTV com:
 * - Suporte completo a .m3u8 e .ts
 * - Preservação de headers de sessão
 * - Retry com backoff exponencial
 * - Sem cache de segmentos (evita 403)
 * - Headers otimizados para Xtream
 * 
 * @version 6.0.0
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// =============================================================================
// CORS HEADERS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, accept-encoding, x-stream-token, x-original-referer',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Cache-Status',
} as const;

// =============================================================================
// CONFIGURATION
// =============================================================================
const CONFIG = {
  FETCH_TIMEOUT_MS: 20000,
  MANIFEST_TIMEOUT_MS: 10000,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 500,
} as const;

// =============================================================================
// SECURITY - BLOCKED PATTERNS (SSRF Protection)
// =============================================================================
const BLOCKED_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  'metadata.google',
  '169.254.',
  'supabase.co',
  'supabase.in',
];

function isUrlBlocked(url: string): boolean {
  const urlLower = url.toLowerCase();
  return BLOCKED_PATTERNS.some(pattern => urlLower.includes(pattern));
}

// =============================================================================
// CONTENT TYPE DETECTION
// =============================================================================
function isManifest(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('.m3u');
}

function isSegment(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.ts') || 
         urlLower.includes('.aac') || 
         urlLower.includes('.mp4') ||
         urlLower.includes('.m4s') ||
         urlLower.includes('.fmp4');
}

function isKeyFile(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.key') || urlLower.includes('key=');
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

function resolveUrl(uri: string, baseUrl: string): string {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  if (uri.startsWith('/')) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${uri}`;
    } catch {
      return uri;
    }
  }
  return `${baseUrl}/${uri}`;
}

// =============================================================================
// HLS MANIFEST REWRITING
// =============================================================================
function rewriteManifest(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n');
  
  return lines.map(line => {
    const trimmed = line.trim();
    
    // Skip empty lines and pure comments
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
      return line;
    }
    
    // Handle encryption key URIs
    if (trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const fullUrl = resolveUrl(uri, baseUrl);
        return `URI="${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}"`;
      });
    }
    
    // Handle segment/playlist URLs (non-comment lines)
    if (!trimmed.startsWith('#')) {
      const fullUrl = resolveUrl(trimmed, baseUrl);
      return `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
    }
    
    return line;
  }).join('\n');
}

// =============================================================================
// FETCH WITH RETRY
// =============================================================================
async function fetchWithRetry(
  url: string,
  headers: Headers,
  timeoutMs: number,
  maxRetries: number
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      // Return response even if not OK (let caller handle status)
      return response;
      
    } catch (err) {
      lastError = err as Error;
      console.log(`[Proxy] Attempt ${attempt + 1} failed: ${lastError.message}`);
      
      if (attempt < maxRetries - 1) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const decodedUrl = decodeURIComponent(targetUrl);

    // Security check
    if (isUrlBlocked(decodedUrl)) {
      console.log(`[Proxy] BLOCKED: ${decodedUrl.substring(0, 50)}...`);
      return new Response(
        JSON.stringify({ error: 'URL not allowed' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const isM3u8 = isManifest(decodedUrl);
    const isTs = isSegment(decodedUrl);
    const isKey = isKeyFile(decodedUrl);

    // Validate stream type
    if (!isM3u8 && !isTs && !isKey) {
      // Allow other media types but log
      console.log(`[Proxy] Non-standard media type: ${decodedUrl.substring(0, 50)}...`);
    }

    const reqType = isM3u8 ? 'M3U8' : isTs ? 'TS' : isKey ? 'KEY' : 'OTHER';
    console.log(`[Proxy] ${reqType}: ${decodedUrl.substring(0, 60)}...`);

    // Build upstream headers - preserve session context
    const upstreamHeaders = new Headers();
    
    // CRITICAL: VLC User-Agent is universally accepted by IPTV providers
    upstreamHeaders.set('User-Agent', 'VLC/3.0.18 LibVLC/3.0.18');
    upstreamHeaders.set('Accept', '*/*');
    upstreamHeaders.set('Connection', 'keep-alive');
    
    // Forward important headers from client
    const headersToForward = ['range', 'authorization', 'cookie', 'x-stream-token'];
    headersToForward.forEach(header => {
      const value = req.headers.get(header);
      if (value) upstreamHeaders.set(header, value);
    });
    
    // Set referer from original URL origin
    try {
      const urlObj = new URL(decodedUrl);
      upstreamHeaders.set('Referer', urlObj.origin + '/');
      upstreamHeaders.set('Origin', urlObj.origin);
    } catch {
      // Ignore
    }

    // Custom referer override
    const customReferer = req.headers.get('x-original-referer');
    if (customReferer) {
      upstreamHeaders.set('Referer', customReferer);
    }

    const timeout = isM3u8 ? CONFIG.MANIFEST_TIMEOUT_MS : CONFIG.FETCH_TIMEOUT_MS;
    const retries = isM3u8 ? 1 : CONFIG.MAX_RETRIES;

    const upstreamResponse = await fetchWithRetry(decodedUrl, upstreamHeaders, timeout, retries);

    // Handle non-OK responses
    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      console.log(`[Proxy] Upstream error: ${upstreamResponse.status}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'UPSTREAM_ERROR', 
          status: upstreamResponse.status,
          message: upstreamResponse.status === 403 ? 'Session expired or access denied' : 'Upstream error'
        }),
        { 
          status: upstreamResponse.status, 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build response headers
    const responseHeaders = new Headers(CORS_HEADERS);
    
    // Determine content type
    let contentType = upstreamResponse.headers.get('Content-Type');
    if (!contentType || contentType === 'application/octet-stream') {
      if (isM3u8) {
        contentType = 'application/vnd.apple.mpegurl';
      } else if (isTs) {
        contentType = 'video/mp2t';
      } else if (isKey) {
        contentType = 'application/octet-stream';
      } else {
        contentType = 'application/octet-stream';
      }
    }
    responseHeaders.set('Content-Type', contentType);
    
    // No cache for segments (avoid stale token issues)
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');

    // Process manifest - rewrite URLs to go through proxy
    if (isM3u8) {
      const manifestContent = await upstreamResponse.text();
      
      // Validate manifest
      if (!manifestContent || !manifestContent.includes('#EXTM3U')) {
        console.error(`[Proxy] Invalid manifest received`);
        return new Response(
          JSON.stringify({ error: 'Invalid HLS manifest' }),
          { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
      
      const baseUrl = getBaseUrl(decodedUrl);
      const proxyBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
      
      const rewrittenManifest = rewriteManifest(manifestContent, baseUrl, proxyBaseUrl);
      
      console.log(`[Proxy] Manifest served, size: ${rewrittenManifest.length}`);
      
      return new Response(rewrittenManifest, { status: 200, headers: responseHeaders });
    }

    // Pass through binary content (segments, keys)
    const passHeaders = ['Content-Length', 'Content-Range', 'Accept-Ranges'];
    passHeaders.forEach(header => {
      const value = upstreamResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    // HEAD request
    if (req.method === 'HEAD') {
      return new Response(null, { status: 200, headers: responseHeaders });
    }

    // Stream body
    if (!upstreamResponse.body) {
      return new Response(null, { status: upstreamResponse.status, headers: responseHeaders });
    }

    return new Response(upstreamResponse.body, { 
      status: upstreamResponse.status, 
      headers: responseHeaders 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Proxy] Error: ${message}`);
    
    const isTimeout = message.includes('abort') || message.includes('timeout');
    
    return new Response(
      JSON.stringify({ 
        error: isTimeout ? 'TIMEOUT' : 'PROXY_ERROR', 
        message 
      }),
      { 
        status: isTimeout ? 504 : 502, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      }
    );
  }
});
