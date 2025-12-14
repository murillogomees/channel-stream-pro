/**
 * Cloudflare Worker - Stream Proxy
 * Proxies IPTV streams (HLS, TS segments) through Cloudflare edge
 * Resolves 403 issues by using Cloudflare's global edge network
 */

export interface Env {
  STREAM_PROXY_SECRET?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Stream-Token, X-Session-Id, User-Agent, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Timeout configurations
const MANIFEST_TIMEOUT = 8000;
const SEGMENT_TIMEOUT = 15000;

async function fetchWithTimeout(url: string, headers: Headers, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      cf: {
        // Cloudflare-specific optimizations
        cacheTtl: 0, // Don't cache on Cloudflare (live content)
        cacheEverything: false,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isM3u8Url(url: string): boolean {
  return url.includes('.m3u8') || url.includes('m3u8');
}

function isTsSegment(url: string): boolean {
  return url.includes('.ts') || url.includes('/ts/') || /\/\d+\.ts/.test(url);
}

function getBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/');
    pathParts.pop();
    return `${parsed.origin}${pathParts.join('/')}`;
  } catch {
    return url.substring(0, url.lastIndexOf('/'));
  }
}

function rewriteManifestUrls(content: string, baseUrl: string, workerUrl: string): string {
  const lines = content.split('\n');
  const rewritten: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments (except URI in tags)
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI='))) {
      // Handle #EXT-X-KEY with URI
      if (trimmed.includes('URI=')) {
        const uriMatch = trimmed.match(/URI="([^"]+)"/);
        if (uriMatch) {
          const keyUrl = uriMatch[1];
          const absoluteKeyUrl = keyUrl.startsWith('http') 
            ? keyUrl 
            : keyUrl.startsWith('/') 
              ? new URL(keyUrl, baseUrl).href
              : `${baseUrl}/${keyUrl}`;
          const proxiedKeyUrl = `${workerUrl}?url=${encodeURIComponent(absoluteKeyUrl)}`;
          rewritten.push(trimmed.replace(uriMatch[1], proxiedKeyUrl));
          continue;
        }
      }
      rewritten.push(line);
      continue;
    }
    
    // It's a URL line (segment or sub-manifest)
    let absoluteUrl: string;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      absoluteUrl = trimmed;
    } else if (trimmed.startsWith('/')) {
      // Absolute path
      const parsed = new URL(baseUrl);
      absoluteUrl = `${parsed.origin}${trimmed}`;
    } else {
      // Relative path
      absoluteUrl = `${baseUrl}/${trimmed}`;
    }
    
    // Proxy through this worker
    const proxiedUrl = `${workerUrl}?url=${encodeURIComponent(absoluteUrl)}`;
    rewritten.push(proxiedUrl);
  }
  
  return rewritten.join('\n');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const workerUrl = `${url.origin}${url.pathname}`;
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        worker: 'stream-proxy',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get target URL from query parameter
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL encoding' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isM3u8 = isM3u8Url(decodedUrl);
    const isTs = isTsSegment(decodedUrl);
    const baseUrl = getBaseUrl(decodedUrl);

    // Build upstream headers - mimic a real player
    const upstreamHeaders = new Headers();
    
    // Essential headers for IPTV providers
    upstreamHeaders.set('User-Agent', 'VLC/3.0.18 LibVLC/3.0.18');
    upstreamHeaders.set('Accept', '*/*');
    upstreamHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    upstreamHeaders.set('Connection', 'keep-alive');
    
    // Set origin-based headers
    try {
      const parsed = new URL(decodedUrl);
      upstreamHeaders.set('Host', parsed.host);
      upstreamHeaders.set('Referer', `${parsed.protocol}//${parsed.host}/`);
      upstreamHeaders.set('Origin', `${parsed.protocol}//${parsed.host}`);
    } catch {
      // Ignore parsing errors
    }

    // Forward important headers from client
    const clientHeaders = ['range', 'if-none-match', 'if-modified-since', 'cookie'];
    for (const header of clientHeaders) {
      const value = request.headers.get(header);
      if (value) {
        upstreamHeaders.set(header, value);
      }
    }

    // Custom referer if provided
    const customReferer = request.headers.get('x-custom-referer');
    if (customReferer) {
      upstreamHeaders.set('Referer', customReferer);
    }

    const timeout = isM3u8 ? MANIFEST_TIMEOUT : SEGMENT_TIMEOUT;

    console.log(`[StreamProxy] ${isM3u8 ? 'M3U8' : isTs ? 'TS' : 'OTHER'}: ${decodedUrl.substring(0, 100)}`);

    try {
      const upstreamResponse = await fetchWithTimeout(decodedUrl, upstreamHeaders, timeout);

      console.log(`[StreamProxy] Upstream: status=${upstreamResponse.status}, type=${upstreamResponse.headers.get('content-type')}`);

      // Handle non-OK responses
      if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
        let errorBody = '';
        try {
          errorBody = await upstreamResponse.text();
        } catch {
          errorBody = 'Unable to read error';
        }
        
        console.error(`[StreamProxy] Error: status=${upstreamResponse.status}, body=${errorBody.substring(0, 200)}`);
        
        return new Response(
          JSON.stringify({ 
            error: 'UPSTREAM_ERROR', 
            status: upstreamResponse.status,
            message: upstreamResponse.status === 403 ? 'Access denied by provider' : 'Upstream error',
            debug: errorBody.substring(0, 100)
          }),
          { 
            status: upstreamResponse.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // For M3U8 manifests, rewrite URLs to proxy through this worker
      if (isM3u8) {
        const manifestText = await upstreamResponse.text();
        const rewritten = rewriteManifestUrls(manifestText, baseUrl, workerUrl);
        
        console.log(`[StreamProxy] Manifest rewritten, size=${rewritten.length}`);
        
        return new Response(rewritten, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }

      // For segments and other content, stream directly
      const responseHeaders = new Headers(corsHeaders);
      
      // Copy relevant headers from upstream
      const copyHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
      for (const header of copyHeaders) {
        const value = upstreamResponse.headers.get(header);
        if (value) {
          responseHeaders.set(header, value);
        }
      }

      // Set appropriate content type for TS segments
      if (isTs && !responseHeaders.has('content-type')) {
        responseHeaders.set('Content-Type', 'video/mp2t');
      }

      // Cache segments briefly (live content changes frequently)
      responseHeaders.set('Cache-Control', isTs ? 'max-age=2' : 'no-cache');

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[StreamProxy] Fetch error: ${errorMessage}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'FETCH_ERROR', 
          message: errorMessage.includes('abort') ? 'Request timeout' : errorMessage 
        }),
        { 
          status: 504, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  },
};
