const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
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

// Get origin from URL
function getOrigin(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return '';
  }
}

// Rewrite URLs in HLS manifest
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

async function fetchWithRetry(url: string, headers: Headers, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 206) {
        return response;
      }
      
      // If 403/401, don't retry - server is blocking us
      if (response.status === 403 || response.status === 401) {
        console.error(`[StreamProxy] Auth error ${response.status} for: ${url.substring(0, 60)}...`);
        return response;
      }
      
      console.warn(`[StreamProxy] Attempt ${attempt + 1} failed with status ${response.status}`);
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
      console.warn(`[StreamProxy] Attempt ${attempt + 1} error: ${lastError.message}`);
      
      if (lastError.name === 'AbortError') {
        continue;
      }
    }
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
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
    const origin = getOrigin(decodedStreamUrl);
    const isSegment = decodedStreamUrl.toLowerCase().includes('.ts');
    
    console.log(`[StreamProxy] ${isSegment ? 'Segment' : 'Manifest'}: ${decodedStreamUrl.substring(0, 70)}...`);

    // Build headers to mimic a real player
    const upstreamHeaders = new Headers();
    
    // Copy range header if present
    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) {
      upstreamHeaders.set('Range', rangeHeader);
    }
    
    // Essential headers for IPTV servers
    upstreamHeaders.set('User-Agent', 'VLC/3.0.20 LibVLC/3.0.20');
    upstreamHeaders.set('Accept', '*/*');
    upstreamHeaders.set('Connection', 'keep-alive');
    
    // Critical: Set Referer to IPTV origin
    if (origin) {
      upstreamHeaders.set('Referer', origin + '/');
    }

    try {
      const streamResponse = await fetchWithRetry(decodedStreamUrl, upstreamHeaders);

      if (!streamResponse.ok && streamResponse.status !== 206) {
        console.error(`[StreamProxy] Upstream error: ${streamResponse.status}`);
        
        // For 403 errors, return specific message
        if (streamResponse.status === 403) {
          return new Response('Stream access denied by server', { 
            status: 403,
            headers: corsHeaders 
          });
        }
        
        return new Response(`Stream unavailable (${streamResponse.status})`, { 
          status: 502,
          headers: corsHeaders 
        });
      }

      let contentType = streamResponse.headers.get('Content-Type');
      const isHls = isHlsContent(decodedStreamUrl, contentType);
      
      // Fix content types
      if (!contentType || contentType === 'application/octet-stream') {
        if (isHls) {
          contentType = 'application/vnd.apple.mpegurl';
        } else if (isSegment) {
          contentType = 'video/mp2t';
        }
      }

      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', contentType || 'application/octet-stream');
      
      if (isHls) {
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        headers.set('Cache-Control', 'public, max-age=2');
      }

      // For HLS manifests, rewrite URLs
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
      
      // Copy important headers for range requests
      const keepHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
      keepHeaders.forEach(header => {
        const value = streamResponse.headers.get(header);
        if (value) headers.set(header, value);
      });

      if (!headers.has('Accept-Ranges')) {
        headers.set('Accept-Ranges', 'bytes');
      }

      // Stream the response body directly
      return new Response(streamResponse.body, {
        status: streamResponse.status,
        headers,
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error(`[StreamProxy] Fetch error: ${errorMessage}`);
      
      if (errorMessage.includes('AbortError') || errorMessage.includes('timeout')) {
        return new Response('Stream timeout', { 
          status: 504,
          headers: corsHeaders 
        });
      }
      
      return new Response(`Fetch error: ${errorMessage}`, { 
        status: 502,
        headers: corsHeaders 
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[StreamProxy] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
