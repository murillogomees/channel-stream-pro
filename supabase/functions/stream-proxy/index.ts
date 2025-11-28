/**
 * ============================================================================
 * IPTV Stream Proxy - Production Grade V3
 * ============================================================================
 * 
 * Proxy otimizado para streams HLS/IPTV com:
 * - Reescrita de URLs em manifests
 * - Fallback HTTPS → HTTP
 * - Headers que bypassam proteção de CDN
 * - Streaming eficiente com ReadableStream
 * - Tratamento robusto de erros de conexão
 * 
 * @version 3.0.0
 */

// =============================================================================
// CORS HEADERS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
} as const;

// =============================================================================
// CONFIGURATION
// =============================================================================
const CONFIG = {
  FETCH_TIMEOUT_MS: 25000,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE_MS: 500,
  MANIFEST_CACHE_SECONDS: 2,
  SEGMENT_CACHE_SECONDS: 5,
} as const;

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
// HLS MANIFEST REWRITING
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
  return urlLower.includes('.ts') || urlLower.includes('.aac') || 
         urlLower.includes('.mp4') || urlLower.includes('.fmp4') ||
         urlLower.includes('.m4s');
}

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

function createUpstreamHeaders(origin: string, rangeHeader: string | null): Headers {
  const headers = new Headers();
  headers.set('User-Agent', 'VLC/3.0.21 LibVLC/3.0.21');
  headers.set('Accept', '*/*');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Connection', 'keep-alive');
  
  if (origin) {
    headers.set('Referer', `${origin}/`);
    headers.set('Origin', origin);
  }
  
  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }
  
  return headers;
}

async function fetchWithRetry(url: string, headers: Headers): Promise<{ response: Response; usedUrl: string }> {
  let lastError: Error | null = null;
  let urlToFetch = url;
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
      
      const response = await fetch(urlToFetch, {
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
      
      // Fallback HTTPS → HTTP on TLS errors
      if (attempt === 0 && urlToFetch.startsWith('https://')) {
        const tlsIndicators = ['tls', 'ssl', 'certificate', 'handshake', 'corrupt'];
        if (tlsIndicators.some(ind => msg.toLowerCase().includes(ind))) {
          urlToFetch = urlToFetch.replace('https://', 'http://');
          continue;
        }
      }
    }
    
    if (attempt < CONFIG.MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const decodedUrl = decodeURIComponent(streamUrl);
    const origin = getOrigin(decodedUrl);
    const isVideoSegment = isSegment(decodedUrl);
    
    // Log request type
    const urlPreview = decodedUrl.length > 60 ? decodedUrl.substring(0, 60) + '...' : decodedUrl;
    console.log(`[Proxy] ${req.method} ${isVideoSegment ? 'SEG' : 'M3U'}: ${urlPreview}`);

    // Build headers
    const rangeHeader = req.headers.get('Range');
    const upstreamHeaders = createUpstreamHeaders(origin, rangeHeader);

    // Fetch upstream
    const { response: streamResponse, usedUrl } = await fetchWithRetry(decodedUrl, upstreamHeaders);

    // Handle errors
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

    // Determine content type
    let contentType = streamResponse.headers.get('Content-Type');
    const isHls = isHlsContent(decodedUrl, contentType);
    
    if (!contentType || contentType === 'application/octet-stream') {
      contentType = isHls 
        ? 'application/vnd.apple.mpegurl' 
        : isVideoSegment 
          ? 'video/mp2t' 
          : 'application/octet-stream';
    }

    // Build response headers
    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set('Content-Type', contentType);
    
    // Cache control
    if (isHls) {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.MANIFEST_CACHE_SECONDS}`);
    } else {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.SEGMENT_CACHE_SECONDS}`);
    }

    // HLS Manifest: rewrite URLs
    if (isHls) {
      const manifestContent = await streamResponse.text();
      const baseUrl = getBaseUrl(usedUrl);
      const proxyBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
      
      const rewrittenManifest = rewriteHlsManifest(manifestContent, baseUrl, proxyBaseUrl);
      
      return new Response(rewrittenManifest, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Video Segment: pass-through with proper headers
    const passHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
    passHeaders.forEach(header => {
      const value = streamResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    // Stream the body - handle connection closure gracefully
    if (!streamResponse.body) {
      return new Response(null, {
        status: streamResponse.status,
        headers: responseHeaders,
      });
    }

    // For HEAD requests, don't stream body
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Stream response body
    return new Response(streamResponse.body, {
      status: streamResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Proxy] Error: ${message}`);
    
    // Timeout specific
    if (message.includes('abort') || message.includes('timeout')) {
      return new Response(
        JSON.stringify({ error: 'Stream timeout - try again' }), 
        { status: 504, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
