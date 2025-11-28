/**
 * ============================================================================
 * M3U Playlist Fetcher & Parser - Optimized v4.0
 * ============================================================================
 * 
 * Super otimizado para carregamento rápido:
 * - Retorna os primeiros canais em < 3 segundos
 * - Early return: não espera parsear tudo
 * - Cache inteligente para requests subsequentes
 * 
 * @version 4.0.0
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

const CONFIG = {
  FETCH_TIMEOUT_MS: 30000,     // 30s timeout para primeira request
  DEFAULT_LIMIT: 500,          // Limite menor para resposta rápida
  CACHE_TTL_MS: 600000,        // 10 min cache
  EARLY_RETURN_COUNT: 500,     // Retornar após parsear X canais
  MAX_PARSE_TIME_MS: 5000,     // Máximo 5s de parse antes de retornar
} as const;

// =============================================================================
// IN-MEMORY CACHE
// =============================================================================
interface CacheEntry {
  channels: Channel[];
  timestamp: number;
  complete: boolean;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function getFromCache(url: string): CacheEntry | null {
  const key = getCacheKey(url);
  const entry = cache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_TTL_MS) {
    console.log(`[M3U] Cache HIT: ${entry.channels.length} channels (complete: ${entry.complete})`);
    return entry;
  }
  
  return null;
}

function setCache(url: string, channels: Channel[], complete: boolean): void {
  const key = getCacheKey(url);
  cache.set(key, {
    channels,
    timestamp: Date.now(),
    complete,
  });
  console.log(`[M3U] Cache SET: ${channels.length} channels (complete: ${complete})`);
}

// =============================================================================
// TYPES
// =============================================================================
interface Channel {
  id: string;
  name: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  tvg_name: string | null;
  stream_url: string;
  category_name: string;
}

interface ParseResult {
  channels: Channel[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  cached: boolean;
  partial?: boolean;
}

// =============================================================================
// FAST STREAMING PARSER - Returns early!
// =============================================================================
async function parseM3UFast(
  response: Response, 
  targetCount: number,
  maxTimeMs: number
): Promise<{ channels: Channel[]; complete: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Stream not available');
  }

  const decoder = new TextDecoder();
  const channels: Channel[] = [];
  
  let buffer = '';
  let currentChannel: Partial<Channel> | null = null;
  let channelIndex = 0;
  const startTime = Date.now();

  try {
    while (true) {
      // Check if we should return early
      if (channels.length >= targetCount) {
        console.log(`[M3U] Early return: reached ${targetCount} channels`);
        reader.releaseLock();
        return { channels, complete: false };
      }

      // Check time limit
      if (Date.now() - startTime > maxTimeMs) {
        console.log(`[M3U] Time limit reached: ${channels.length} channels in ${maxTimeMs}ms`);
        reader.releaseLock();
        return { channels, complete: false };
      }

      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed) continue;

        if (trimmed.startsWith('#EXTINF:')) {
          currentChannel = parseExtinfLine(trimmed, channelIndex++);
        }
        else if (currentChannel && !trimmed.startsWith('#')) {
          currentChannel.stream_url = trimmed;
          
          if (currentChannel.name && currentChannel.stream_url) {
            channels.push(currentChannel as Channel);
          }
          
          currentChannel = null;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim() && currentChannel && !buffer.trim().startsWith('#')) {
      currentChannel.stream_url = buffer.trim();
      if (currentChannel.name && currentChannel.stream_url) {
        channels.push(currentChannel as Channel);
      }
    }

  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  return { channels, complete: true };
}

// Full parse for background caching
async function parseM3UFull(response: Response): Promise<Channel[]> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Stream not available');
  }

  const decoder = new TextDecoder();
  const channels: Channel[] = [];
  
  let buffer = '';
  let currentChannel: Partial<Channel> | null = null;
  let channelIndex = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('#EXTINF:')) {
          currentChannel = parseExtinfLine(trimmed, channelIndex++);
        }
        else if (currentChannel && !trimmed.startsWith('#')) {
          currentChannel.stream_url = trimmed;
          if (currentChannel.name && currentChannel.stream_url) {
            channels.push(currentChannel as Channel);
          }
          currentChannel = null;
        }
      }
    }

    if (buffer.trim() && currentChannel && !buffer.trim().startsWith('#')) {
      currentChannel.stream_url = buffer.trim();
      if (currentChannel.name && currentChannel.stream_url) {
        channels.push(currentChannel as Channel);
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  return channels;
}

function parseExtinfLine(line: string, index: number): Partial<Channel> {
  const channel: Partial<Channel> = {
    id: `ch-${index}`,
    name: '',
    tvg_logo: null,
    tvg_id: null,
    tvg_name: null,
    stream_url: '',
    category_name: 'Outros',
  };

  const nameMatch = line.match(/,\s*(.+)$/);
  if (nameMatch) {
    channel.name = nameMatch[1].trim();
  }

  const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
  if (logoMatch && logoMatch[1]) {
    channel.tvg_logo = logoMatch[1];
  }

  const idMatch = line.match(/tvg-id="([^"]*)"/i);
  if (idMatch && idMatch[1]) {
    channel.tvg_id = idMatch[1];
  }

  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  if (tvgNameMatch && tvgNameMatch[1]) {
    channel.tvg_name = tvgNameMatch[1];
  }

  const categoryMatch = line.match(/group-title="([^"]*)"/i);
  if (categoryMatch && categoryMatch[1]) {
    channel.category_name = categoryMatch[1];
  }

  return channel;
}

// =============================================================================
// HTTP FETCHING
// =============================================================================
async function fetchM3U(url: string): Promise<Response> {
  let urlToFetch = url;
  
  try {
    return await fetchWithTimeout(urlToFetch);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    
    if (urlToFetch.startsWith('https://') && isTlsError(message)) {
      console.log('[M3U] HTTPS failed, trying HTTP...');
      urlToFetch = urlToFetch.replace('https://', 'http://');
      return await fetchWithTimeout(urlToFetch);
    }
    
    throw error;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21',
        'Accept': '*/*',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTlsError(message: string): boolean {
  const indicators = ['tls', 'ssl', 'certificate', 'handshake', 'corrupt', 'InvalidContentType'];
  const lower = message.toLowerCase();
  return indicators.some(i => lower.includes(i.toLowerCase()));
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { url, limit, offset = 0 } = body;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveLimit = Math.min(limit || CONFIG.DEFAULT_LIMIT, 5000);
    
    console.log(`[M3U] Request: limit=${effectiveLimit}, offset=${offset}`);

    // Check cache first
    const cached = getFromCache(url);
    
    if (cached && (cached.complete || offset < cached.channels.length)) {
      const total = cached.complete ? cached.channels.length : cached.channels.length + 100000; // Estimate
      const paginatedChannels = cached.channels.slice(offset, offset + effectiveLimit);
      const hasMore = cached.complete 
        ? (offset + effectiveLimit < cached.channels.length)
        : true;

      console.log(`[M3U] Cache response in ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({
          channels: paginatedChannels,
          total: cached.complete ? cached.channels.length : Math.max(cached.channels.length, offset + effectiveLimit + 1000),
          offset,
          limit: effectiveLimit,
          hasMore,
          cached: true,
          partial: !cached.complete,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Need to fetch
    console.log(`[M3U] Fetching: ${url.substring(0, 60)}...`);
    
    const response = await fetchM3U(url);

    if (!response.ok) {
      throw new Error(`M3U fetch failed: ${response.status} ${response.statusText}`);
    }

    // For first request (offset=0), use fast parsing with early return
    if (offset === 0) {
      const targetCount = Math.max(effectiveLimit * 2, CONFIG.EARLY_RETURN_COUNT);
      
      console.log(`[M3U] Fast parsing (target: ${targetCount} channels, max: ${CONFIG.MAX_PARSE_TIME_MS}ms)...`);
      
      const { channels, complete } = await parseM3UFast(
        response, 
        targetCount,
        CONFIG.MAX_PARSE_TIME_MS
      );
      
      console.log(`[M3U] Parsed ${channels.length} channels in ${Date.now() - startTime}ms (complete: ${complete})`);
      
      // Cache what we have
      setCache(url, channels, complete);
      
      const paginatedChannels = channels.slice(0, effectiveLimit);
      
      // Estimate total if not complete
      const estimatedTotal = complete 
        ? channels.length 
        : Math.max(channels.length * 10, 50000); // Conservative estimate

      const result: ParseResult = {
        channels: paginatedChannels,
        total: estimatedTotal,
        offset: 0,
        limit: effectiveLimit,
        hasMore: channels.length > effectiveLimit || !complete,
        cached: false,
        partial: !complete,
      };

      console.log(`[M3U] Response in ${Date.now() - startTime}ms: ${paginatedChannels.length} channels`);

      // If not complete, schedule background full parse
      if (!complete) {
        EdgeRuntime.waitUntil(
          (async () => {
            try {
              console.log('[M3U] Background: fetching full playlist...');
              const bgResponse = await fetchM3U(url);
              if (bgResponse.ok) {
                const allChannels = await parseM3UFull(bgResponse);
                setCache(url, allChannels, true);
                console.log(`[M3U] Background complete: ${allChannels.length} channels cached`);
              }
            } catch (err) {
              console.error('[M3U] Background parse error:', err);
            }
          })()
        );
      }

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // For subsequent requests, we need the full parse
    console.log('[M3U] Full parsing for paginated request...');
    const allChannels = await parseM3UFull(response);
    
    console.log(`[M3U] Parsed ${allChannels.length} channels total`);
    setCache(url, allChannels, true);

    const paginatedChannels = allChannels.slice(offset, offset + effectiveLimit);
    const hasMore = offset + effectiveLimit < allChannels.length;

    console.log(`[M3U] Response in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        channels: paginatedChannels,
        total: allChannels.length,
        offset,
        limit: effectiveLimit,
        hasMore,
        cached: false,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('abort') || message.includes('timeout');
    
    console.error(`[M3U] Error after ${Date.now() - startTime}ms: ${message}`);

    return new Response(
      JSON.stringify({ 
        error: isTimeout ? 'M3U fetch timeout' : message 
      }),
      { 
        status: isTimeout ? 504 : 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      }
    );
  }
});
