/**
 * ============================================================================
 * IPTV Stream Proxy - Production Grade
 * ============================================================================
 * 
 * Proxy para streams HLS que:
 * - Reescreve URLs de manifests (.m3u8) para passar pelo proxy
 * - Faz proxy de segmentos (.ts) com headers corretos
 * - Suporta Range requests (seek)
 * - Fallback HTTPS → HTTP automático
 * - Headers que bypassam proteção de IPTV servers
 * 
 * @version 2.0.0
 * @author IPTV Link
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
  FETCH_TIMEOUT_MS: 20000,      // 20s timeout por request
  MAX_RETRIES: 3,               // Máximo de tentativas
  RETRY_DELAY_BASE_MS: 300,     // Base do delay entre retries (exponential)
  SEGMENT_CACHE_SECONDS: 3,     // Cache de segmentos
} as const;

// =============================================================================
// TYPES
// =============================================================================
interface FetchResult {
  response: Response;
  usedUrl: string;
}

// =============================================================================
// URL UTILITIES
// =============================================================================

/**
 * Extrai a base URL (sem o arquivo) de uma URL completa
 */
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    pathParts.pop(); // Remove filename
    return `${urlObj.protocol}//${urlObj.host}${pathParts.join('/')}`;
  } catch {
    const lastSlash = url.lastIndexOf('/');
    return lastSlash > 0 ? url.substring(0, lastSlash) : url;
  }
}

/**
 * Extrai origin (protocol + host) de uma URL
 */
function getOrigin(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return '';
  }
}

/**
 * Resolve URL relativa para absoluta
 */
function resolveUrl(url: string, baseUrl: string): string {
  // Já é absoluta
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Path absoluto (começa com /)
  if (url.startsWith('/')) {
    try {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    } catch {
      return url;
    }
  }
  
  // Path relativo
  return `${baseUrl}/${url}`;
}

// =============================================================================
// HLS MANIFEST REWRITING
// =============================================================================

/**
 * Detecta se o conteúdo é HLS baseado na URL ou Content-Type
 */
function isHlsContent(url: string, contentType: string | null): boolean {
  const urlLower = url.toLowerCase();
  
  // Check URL extension
  if (urlLower.includes('.m3u8') || urlLower.includes('.m3u')) {
    return true;
  }
  
  // Check Content-Type
  if (contentType) {
    const ctLower = contentType.toLowerCase();
    return ctLower.includes('mpegurl') || 
           ctLower.includes('x-mpegurl') || 
           ctLower.includes('vnd.apple');
  }
  
  return false;
}

/**
 * Detecta se é um segmento de vídeo
 */
function isSegment(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.ts') || 
         urlLower.includes('.aac') || 
         urlLower.includes('.mp4') ||
         urlLower.includes('.fmp4');
}

/**
 * Reescreve todas as URLs em um manifest HLS para passar pelo proxy
 */
function rewriteHlsManifest(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n');
  
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    // Linha vazia ou comentário simples - mantém
    if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.includes('URI="'))) {
      return line;
    }
    
    // Tags com URI (ex: #EXT-X-KEY:METHOD=AES-128,URI="...")
    if (trimmedLine.includes('URI="')) {
      return rewriteUriInTag(trimmedLine, baseUrl, proxyBaseUrl);
    }
    
    // URL de segmento ou playlist (linha sem #)
    if (!trimmedLine.startsWith('#')) {
      const fullUrl = resolveUrl(trimmedLine, baseUrl);
      return `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
    }
    
    return line;
  });
  
  return rewrittenLines.join('\n');
}

/**
 * Reescreve atributos URI="" dentro de tags HLS
 */
function rewriteUriInTag(line: string, baseUrl: string, proxyBaseUrl: string): string {
  return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
    const fullUrl = resolveUrl(uri, baseUrl);
    const proxiedUrl = `${proxyBaseUrl}?url=${encodeURIComponent(fullUrl)}`;
    return `URI="${proxiedUrl}"`;
  });
}

// =============================================================================
// HTTP FETCHING
// =============================================================================

/**
 * Cria headers que simulam um player real (VLC/IPTV box)
 * Essencial para bypass de proteção de servidores IPTV
 */
function createUpstreamHeaders(origin: string, rangeHeader: string | null): Headers {
  const headers = new Headers();
  
  // User-Agent de player real - CRÍTICO para bypass
  headers.set('User-Agent', 'VLC/3.0.21 LibVLC/3.0.21');
  headers.set('Accept', '*/*');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Connection', 'keep-alive');
  
  // Referer = origin do IPTV - CRÍTICO para bypass
  if (origin) {
    headers.set('Referer', `${origin}/`);
    headers.set('Origin', origin);
  }
  
  // Range para seek
  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }
  
  return headers;
}

/**
 * Fetch com retry, timeout e fallback HTTPS → HTTP
 */
async function fetchWithRetry(
  url: string, 
  headers: Headers
): Promise<FetchResult> {
  let lastError: Error | null = null;
  let urlToFetch = url;
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(urlToFetch, headers);
      
      // Sucesso
      if (response.ok || response.status === 206) {
        return { response, usedUrl: urlToFetch };
      }
      
      // 403/401 = bloqueado pelo servidor, não adianta retry
      if (response.status === 403 || response.status === 401) {
        console.error(`[Proxy] Blocked (${response.status}): ${urlToFetch.substring(0, 80)}...`);
        return { response, usedUrl: urlToFetch };
      }
      
      lastError = new Error(`HTTP ${response.status}`);
      console.warn(`[Proxy] Attempt ${attempt + 1}/${CONFIG.MAX_RETRIES} failed: ${response.status}`);
      
    } catch (err) {
      lastError = err as Error;
      const msg = lastError.message || '';
      
      console.warn(`[Proxy] Attempt ${attempt + 1}/${CONFIG.MAX_RETRIES} error: ${msg.substring(0, 100)}`);
      
      // Fallback HTTPS → HTTP em caso de erro TLS
      if (attempt === 0 && urlToFetch.startsWith('https://') && isTlsError(msg)) {
        console.log(`[Proxy] TLS error, falling back to HTTP...`);
        urlToFetch = urlToFetch.replace('https://', 'http://');
        continue; // Retry imediatamente com HTTP
      }
    }
    
    // Exponential backoff
    if (attempt < CONFIG.MAX_RETRIES - 1) {
      const delay = CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Fetch com timeout
 */
async function fetchWithTimeout(url: string, headers: Headers): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verifica se é um erro de TLS
 */
function isTlsError(message: string): boolean {
  const tlsIndicators = [
    'tls', 'ssl', 'certificate', 'handshake', 
    'corrupt', 'InvalidContentType', 'CERT_'
  ];
  const msgLower = message.toLowerCase();
  return tlsIndicators.some(ind => msgLower.includes(ind.toLowerCase()));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    // Validação de parâmetro
    if (!streamUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }), 
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const decodedUrl = decodeURIComponent(streamUrl);
    const origin = getOrigin(decodedUrl);
    const isVideoSegment = isSegment(decodedUrl);
    
    // Log resumido
    const urlPreview = decodedUrl.length > 80 ? decodedUrl.substring(0, 80) + '...' : decodedUrl;
    console.log(`[Proxy] ${isVideoSegment ? 'SEG' : 'M3U'}: ${urlPreview}`);

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
    
    // Fix content types
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
    
    // Cache: manifests = no-cache, segments = short cache
    if (isHls) {
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      responseHeaders.set('Cache-Control', `public, max-age=${CONFIG.SEGMENT_CACHE_SECONDS}`);
    }

    // HLS Manifest: rewrite URLs
    if (isHls) {
      const manifestContent = await streamResponse.text();
      const baseUrl = getBaseUrl(usedUrl); // Usa URL final (pode ser HTTP após fallback)
      const proxyBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
      
      const rewrittenManifest = rewriteHlsManifest(manifestContent, baseUrl, proxyBaseUrl);
      
      return new Response(rewrittenManifest, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Video Segment: pass-through com headers de range
    const passHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
    passHeaders.forEach(header => {
      const value = streamResponse.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    // Garante Accept-Ranges
    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    // Stream body directly
    return new Response(streamResponse.body, {
      status: streamResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Proxy] Fatal: ${message}`);
    
    // Timeout específico
    if (message.includes('abort') || message.includes('timeout')) {
      return new Response(
        JSON.stringify({ error: 'Stream timeout' }), 
        { status: 504, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
