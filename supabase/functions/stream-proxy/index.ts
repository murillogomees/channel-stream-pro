const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

// Helper to get base URL from a full URL
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

// Get origin (protocol + host) from URL
function getOrigin(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return '';
  }
}

// Rewrite URLs in HLS manifest to go through proxy
function rewriteHlsManifest(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.includes('URI="'))) {
      if (trimmedLine.includes('URI="')) {
        return rewriteUriInTag(trimmedLine, baseUrl, proxyBaseUrl);
      }
      return line;
    }
    
    if (trimmedLine.startsWith('#') && trimmedLine.includes('URI="')) {
      return rewriteUriInTag(trimmedLine, baseUrl, proxyBaseUrl);
    }
    
    if (!trimmedLine.startsWith('#')) {
      return rewriteUrl(trimmedLine, baseUrl, proxyBaseUrl);
    }
    
    return line;
  });
  
  return rewrittenLines.join('\n');
}

function rewriteUriInTag(line: string, baseUrl: string, proxyBaseUrl: string): string {
  return line.replace(/URI="([^"]+)"/g, (match, uri) => {
    const fullUrl = resolveUrl(uri, baseUrl);
    const proxiedUrl = `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
    return `URI="${proxiedUrl}"`;
  });
}

function rewriteUrl(url: string, baseUrl: string, proxyBaseUrl: string): string {
  const fullUrl = resolveUrl(url.trim(), baseUrl);
  return `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
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

function isHlsContent(url: string, contentType: string | null): boolean {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u')) {
    return true;
  }
  if (contentType) {
    const ctLower = contentType.toLowerCase();
    return ctLower.includes('mpegurl') || ctLower.includes('x-mpegurl') || ctLower.includes('vnd.apple');
  }
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      return new Response('Missing url parameter', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const decodedStreamUrl = decodeURIComponent(streamUrl);
    console.log(`[StreamProxy] Proxying: ${decodedStreamUrl.substring(0, 80)}...`);

    const origin = getOrigin(decodedStreamUrl);

    // Prepare headers for upstream - mimic a real browser/player request
    const upstreamHeaders = new Headers();
    
    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) {
      upstreamHeaders.set('Range', rangeHeader);
    }
    
    // Set headers to mimic real player/browser request
    upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    upstreamHeaders.set('Accept', '*/*');
    upstreamHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    upstreamHeaders.set('Accept-Encoding', 'identity'); // Don't compress, we need to stream
    
    // Critical: Set Referer and Origin to the IPTV server itself
    if (origin) {
      upstreamHeaders.set('Referer', origin + '/');
      upstreamHeaders.set('Origin', origin);
    }
    
    // Connection keep-alive for streaming
    upstreamHeaders.set('Connection', 'keep-alive');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const streamResponse = await fetch(decodedStreamUrl, {
        headers: upstreamHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!streamResponse.ok) {
        console.error(`[StreamProxy] Upstream error: ${streamResponse.status}`);
        return new Response(`Stream unavailable (${streamResponse.status})`, { 
          status: 502,
          headers: corsHeaders 
        });
      }

      let contentType = streamResponse.headers.get('Content-Type');
      const isHls = isHlsContent(decodedStreamUrl, contentType);
      
      if (!contentType || contentType === 'application/octet-stream') {
        if (isHls) {
          contentType = 'application/vnd.apple.mpegurl';
        } else if (decodedStreamUrl.includes('.ts')) {
          contentType = 'video/mp2t';
        } else {
          contentType = 'video/mp2t';
        }
      }

      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', contentType);
      
      if (isHls) {
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        // Short cache for segments - they change frequently in live streams
        headers.set('Cache-Control', 'public, max-age=5');
      }

      // Rewrite HLS manifest URLs
      if (isHls) {
        const manifestContent = await streamResponse.text();
        const baseUrl = getBaseUrl(decodedStreamUrl);
        const proxyBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
        
        const rewrittenManifest = rewriteHlsManifest(manifestContent, baseUrl, proxyBaseUrl);
        
        return new Response(rewrittenManifest, {
          status: 200,
          headers,
        });
      }
      
      const keepHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
      keepHeaders.forEach(header => {
        const value = streamResponse.headers.get(header);
        if (value) headers.set(header, value);
      });

      if (!headers.has('Accept-Ranges')) {
        headers.set('Accept-Ranges', 'bytes');
      }

      return new Response(streamResponse.body, {
        status: streamResponse.status,
        headers,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return new Response('Stream timeout', { 
          status: 504,
          headers: corsHeaders 
        });
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('[StreamProxy] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
