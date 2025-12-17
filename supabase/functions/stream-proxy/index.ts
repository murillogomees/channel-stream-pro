/**
 * ============================================================================
 * IPTV Stream Proxy - Enterprise Grade V7
 * ============================================================================
 * 
 * Proxy para streams HLS/IPTV com:
 * - Suporte a proxy residencial rotativo
 * - Preservação de headers de sessão
 * - Retry com backoff exponencial
 * - Sem cache de segmentos (evita 403)
 * - Headers otimizados para Xtream
 * 
 * @version 7.0.0
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// =============================================================================
// CORS HEADERS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, accept-encoding, x-stream-token, x-original-referer, x-session-id, x-retry-count',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Cache-Status',
} as const;

// =============================================================================
// CONFIGURATION
// =============================================================================
const CONFIG = {
  FETCH_TIMEOUT_MS: 25000,
  MANIFEST_TIMEOUT_MS: 15000,
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
// PROXY CONFIGURATION
// =============================================================================
interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

function parseProxyUrl(proxyUrl: string): ProxyConfig | null {
  try {
    // Format: user:pass@host:port
    const match = proxyUrl.match(/^([^:]+):([^@]+)@([^:]+):(\d+)$/);
    if (match) {
      return {
        username: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4], 10),
      };
    }
    
    // Try URL format: http://user:pass@host:port
    const url = new URL(proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`);
    return {
      username: url.username,
      password: url.password,
      host: url.hostname,
      port: parseInt(url.port, 10) || 80,
    };
  } catch (e) {
    console.error('[Proxy] Failed to parse proxy URL:', e);
    return null;
  }
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
  return urlLower.endsWith('.ts') || 
         urlLower.endsWith('.aac') || 
         urlLower.endsWith('.m4s') ||
         urlLower.endsWith('.fmp4') ||
         urlLower.includes('/hls/');
}

function isMp4(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.mp4') || 
         urlLower.endsWith('.mkv') ||
         urlLower.endsWith('.avi') ||
         urlLower.endsWith('.webm') ||
         urlLower.endsWith('.mov') ||
         urlLower.includes('/movie/') ||
         urlLower.includes('/series/');
}

function isKeyFile(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.key') || urlLower.includes('/key/');
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
    
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
      return line;
    }
    
    if (trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const fullUrl = resolveUrl(uri, baseUrl);
        return `URI="${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}"`;
      });
    }
    
    if (!trimmed.startsWith('#')) {
      const fullUrl = resolveUrl(trimmed, baseUrl);
      return `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
    }
    
    return line;
  }).join('\n');
}

// =============================================================================
// FETCH VIA RESIDENTIAL PROXY (HTTP CONNECT)
// =============================================================================
async function fetchViaProxy(
  targetUrl: string,
  headers: Headers,
  proxyConfig: ProxyConfig,
  timeoutMs: number,
  redirectCount: number = 0
): Promise<Response> {
  // Prevent infinite redirect loops
  if (redirectCount > 5) {
    throw new Error('Too many redirects');
  }

  const targetParsed = new URL(targetUrl);
  const isHttps = targetParsed.protocol === 'https:';
  const targetPort = targetParsed.port || (isHttps ? 443 : 80);
  
  console.log(`[Proxy] Connecting via residential proxy ${proxyConfig.host}:${proxyConfig.port}`);
  
  // Create connection to proxy
  const conn = await Deno.connect({
    hostname: proxyConfig.host,
    port: proxyConfig.port,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  try {
    // For HTTP targets, we can use direct HTTP proxy method
    if (!isHttps) {
      // Build HTTP request to proxy for HTTP target
      const proxyAuth = btoa(`${proxyConfig.username}:${proxyConfig.password}`);
      
      let requestLine = `GET ${targetUrl} HTTP/1.1\r\n`;
      requestLine += `Host: ${targetParsed.host}\r\n`;
      requestLine += `Proxy-Authorization: Basic ${proxyAuth}\r\n`;
      requestLine += `User-Agent: VLC/3.0.18 LibVLC/3.0.18\r\n`;
      requestLine += `Accept: */*\r\n`;
      requestLine += `Connection: close\r\n`;
      
      // Add custom headers
      headers.forEach((value, key) => {
        if (!['host', 'proxy-authorization', 'user-agent', 'accept', 'connection'].includes(key.toLowerCase())) {
          requestLine += `${key}: ${value}\r\n`;
        }
      });
      
      requestLine += `\r\n`;
      
      await conn.write(encoder.encode(requestLine));
      
      // Read response with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Proxy timeout')), timeoutMs);
      });
      
      // Read all response data
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      const buffer = new Uint8Array(65536);
      
      const readResponse = async (): Promise<Response> => {
        while (true) {
          const n = await conn.read(buffer);
          if (n === null) break;
          chunks.push(buffer.slice(0, n));
          totalSize += n;
          
          // Check if we've received headers + some body
          const fullData = new Uint8Array(totalSize);
          let offset = 0;
          for (const chunk of chunks) {
            fullData.set(chunk, offset);
            offset += chunk.length;
          }
          
          const text = decoder.decode(fullData);
          const headerEnd = text.indexOf('\r\n\r\n');
          
          if (headerEnd !== -1) {
            // Parse headers
            const headerText = text.substring(0, headerEnd);
            const [statusLine, ...headerLines] = headerText.split('\r\n');
            
            const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
            const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
            
            const responseHeaders = new Headers();
            for (const line of headerLines) {
              const colonIndex = line.indexOf(':');
              if (colonIndex > 0) {
                responseHeaders.set(
                  line.substring(0, colonIndex).trim(),
                  line.substring(colonIndex + 1).trim()
                );
              }
            }
            
            // Handle redirects (301, 302, 303, 307, 308)
            if (status >= 300 && status < 400) {
              const location = responseHeaders.get('Location');
              if (location) {
                console.log(`[Proxy] Following ${status} redirect to: ${location.substring(0, 80)}`);
                conn.close();
                
                // Resolve relative URLs
                const redirectUrl = location.startsWith('http') 
                  ? location 
                  : `${targetParsed.protocol}//${targetParsed.host}${location.startsWith('/') ? location : '/' + location}`;
                
                // Follow the redirect
                return await fetchViaProxy(redirectUrl, headers, proxyConfig, timeoutMs, redirectCount + 1);
              }
            }
            
            // Get body data
            const bodyStart = headerEnd + 4;
            const bodyData = fullData.slice(bodyStart);
            
            // Check content-length
            const contentLength = responseHeaders.get('Content-Length');
            if (contentLength) {
              const expectedLength = parseInt(contentLength, 10);
              const currentBodyLength = bodyData.length;
              
              if (currentBodyLength < expectedLength) {
                // Need to read more
                const remaining = new Uint8Array(expectedLength - currentBodyLength);
                let readOffset = 0;
                
                while (readOffset < remaining.length) {
                  const n = await conn.read(remaining.subarray(readOffset));
                  if (n === null) break;
                  readOffset += n;
                }
                
                // Combine
                const fullBody = new Uint8Array(bodyData.length + readOffset);
                fullBody.set(bodyData, 0);
                fullBody.set(remaining.subarray(0, readOffset), bodyData.length);
                
                return new Response(fullBody, { status, headers: responseHeaders });
              }
            }
            
            // For chunked or unknown length, return what we have
            return new Response(bodyData, { status, headers: responseHeaders });
          }
        }
        
        throw new Error('Connection closed without complete response');
      };
      
      return await Promise.race([readResponse(), timeoutPromise]);
    } else {
      // For HTTPS targets, use CONNECT tunnel
      const proxyAuth = btoa(`${proxyConfig.username}:${proxyConfig.password}`);
      const connectRequest = `CONNECT ${targetParsed.hostname}:${targetPort} HTTP/1.1\r\n` +
        `Host: ${targetParsed.hostname}:${targetPort}\r\n` +
        `Proxy-Authorization: Basic ${proxyAuth}\r\n` +
        `Connection: keep-alive\r\n\r\n`;
      
      await conn.write(encoder.encode(connectRequest));
      
      // Read CONNECT response
      const responseBuffer = new Uint8Array(1024);
      const bytesRead = await conn.read(responseBuffer);
      
      if (bytesRead === null) {
        throw new Error('Proxy connection closed');
      }
      
      const response = decoder.decode(responseBuffer.subarray(0, bytesRead));
      
      if (!response.includes('200')) {
        throw new Error(`Proxy CONNECT failed: ${response.substring(0, 100)}`);
      }
      
      console.log(`[Proxy] CONNECT tunnel established`);
      
      // For HTTPS, we would need TLS handshake - falling back to direct for now
      // This is a limitation - residential proxy works best with HTTP targets
      conn.close();
      
      // Fallback to direct fetch for HTTPS
      console.log(`[Proxy] HTTPS target - falling back to direct fetch`);
      return await fetch(targetUrl, { headers, redirect: 'follow' });
    }
  } finally {
    try {
      conn.close();
    } catch {
      // Ignore close errors
    }
  }
}

// =============================================================================
// FETCH WITH RETRY (with proxy support)
// =============================================================================
async function fetchWithRetry(
  url: string,
  headers: Headers,
  timeoutMs: number,
  maxRetries: number,
  proxyConfig: ProxyConfig | null
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try via residential proxy first if configured
      if (proxyConfig) {
        console.log(`[Proxy] Attempt ${attempt + 1} via residential proxy`);
        return await fetchViaProxy(url, headers, proxyConfig, timeoutMs);
      }
      
      // Direct fetch fallback
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
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

    if (isUrlBlocked(decodedUrl)) {
      console.log(`[Proxy] BLOCKED: ${decodedUrl.substring(0, 50)}...`);
      return new Response(
        JSON.stringify({ error: 'URL not allowed' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Parse residential proxy config
    const proxyUrlEnv = Deno.env.get('RESIDENTIAL_PROXY_URL');
    const proxyConfig = proxyUrlEnv ? parseProxyUrl(proxyUrlEnv) : null;
    
    if (proxyConfig) {
      console.log(`[Proxy] 🏠 Residential proxy enabled: ${proxyConfig.host}:${proxyConfig.port}`);
    }

    const isM3u8 = isManifest(decodedUrl);
    const isTs = isSegment(decodedUrl);
    const isMp4File = isMp4(decodedUrl);
    const isKey = isKeyFile(decodedUrl);

    if (!isM3u8 && !isTs && !isKey && !isMp4File) {
      console.log(`[Proxy] Non-standard media type: ${decodedUrl.substring(0, 50)}...`);
    }

    const reqType = isM3u8 ? 'M3U8' : isTs ? 'TS' : isMp4File ? 'MP4' : isKey ? 'KEY' : 'OTHER';
    console.log(`[Proxy] ${reqType}: ${decodedUrl.substring(0, 80)}`);

    // Build upstream headers
    const upstreamHeaders = new Headers();
    upstreamHeaders.set('User-Agent', 'VLC/3.0.18 LibVLC/3.0.18');
    upstreamHeaders.set('Accept', '*/*');
    upstreamHeaders.set('Connection', 'keep-alive');
    
    try {
      const urlObj = new URL(decodedUrl);
      upstreamHeaders.set('Referer', `${urlObj.protocol}//${urlObj.host}/`);
      upstreamHeaders.set('Origin', `${urlObj.protocol}//${urlObj.host}`);
      upstreamHeaders.set('Host', urlObj.host);
    } catch {
      // Ignore
    }

    const headersToForward = ['range', 'cookie', 'if-none-match', 'if-modified-since'];
    headersToForward.forEach(header => {
      const value = req.headers.get(header);
      if (value) upstreamHeaders.set(header, value);
    });
    
    const customReferer = req.headers.get('x-original-referer');
    if (customReferer) {
      upstreamHeaders.set('Referer', customReferer);
    }

    console.log(`[Proxy] Request: Host=${upstreamHeaders.get('Host')}, via_proxy=${!!proxyConfig}`);

    const timeout = isM3u8 ? CONFIG.MANIFEST_TIMEOUT_MS : CONFIG.FETCH_TIMEOUT_MS;
    const retries = isM3u8 ? 1 : CONFIG.MAX_RETRIES;

    const upstreamResponse = await fetchWithRetry(decodedUrl, upstreamHeaders, timeout, retries, proxyConfig);

    console.log(`[Proxy] Upstream response: status=${upstreamResponse.status}`);

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      let errorBody = '';
      try {
        const bodyText = await upstreamResponse.text();
        errorBody = bodyText.substring(0, 200);
      } catch {
        errorBody = 'Unable to read error body';
      }
      
      if (upstreamResponse.status === 403) {
        console.error(`[Proxy] ❌ 403 BLOCKED - URL: ${decodedUrl.substring(0, 60)}`);
        console.error(`[Proxy] Proxy used: ${proxyConfig ? 'YES' : 'NO'}`);
        if (proxyConfig) {
          console.error(`[Proxy] Even with residential proxy, provider blocked. May need different proxy region.`);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'UPSTREAM_ERROR', 
          status: upstreamResponse.status,
          message: upstreamResponse.status === 403 
            ? 'Servidor do provedor bloqueou acesso (403)' 
            : 'Upstream error',
          debug: errorBody.substring(0, 100),
          proxy_used: !!proxyConfig
        }),
        { 
          status: upstreamResponse.status, 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }

    const responseHeaders = new Headers(CORS_HEADERS);
    
    let contentType = upstreamResponse.headers.get('Content-Type');
    if (!contentType || contentType === 'application/octet-stream') {
      if (isM3u8) {
        contentType = 'application/vnd.apple.mpegurl';
      } else if (isTs) {
        contentType = 'video/mp2t';
      } else if (isMp4File) {
        contentType = 'video/mp4';
      } else {
        contentType = 'application/octet-stream';
      }
    }
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');

    if (isM3u8) {
      const manifestContent = await upstreamResponse.text();
      
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
      
      console.log(`[Proxy] Manifest served via ${proxyConfig ? 'residential proxy' : 'direct'}`);
      
      return new Response(rewrittenManifest, { status: 200, headers: responseHeaders });
    }

    const passHeaders = ['Content-Length', 'Content-Range', 'Accept-Ranges'];
    passHeaders.forEach(header => {
      const value = upstreamResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    if (req.method === 'HEAD') {
      return new Response(null, { status: 200, headers: responseHeaders });
    }

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
