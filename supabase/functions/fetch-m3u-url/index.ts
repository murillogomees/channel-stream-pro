/**
 * ============================================================================
 * M3U Playlist Fetcher & Parser - Optimized v5.0
 * ============================================================================
 * 
 * Otimizado para evitar CPU Time Exceeded:
 * - Limita parsing por tempo
 * - Cache com TTL mais longo
 * - Retorna parcial quando necessário
 * - Paginação inteligente sem full parse
 * 
 * @version 5.0.0
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

const CONFIG = {
  FETCH_TIMEOUT_MS: 25000,     // 25s timeout
  DEFAULT_LIMIT: 500,          // Limite padrão
  CACHE_TTL_MS: 1800000,       // 30 min cache (mais longo)
  MAX_PARSE_TIME_MS: 8000,     // Máximo 8s de parse
  CHUNK_SIZE: 65536,           // 64KB chunks for reading
} as const;

// =============================================================================
// IN-MEMORY CACHE (Global para instância do worker)
// =============================================================================
interface CacheEntry {
  channels: Channel[];
  timestamp: number;
  complete: boolean;
  parsing?: boolean;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    // Include query params in key for different users
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
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
  
  if (entry) {
    cache.delete(key); // Expired
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
  retryAfter?: number;
}

// =============================================================================
// OPTIMIZED STREAMING PARSER - Time-limited with yield points
// =============================================================================
async function parseM3UWithTimeLimit(
  response: Response, 
  maxTimeMs: number,
  startOffset: number = 0
): Promise<{ channels: Channel[]; complete: boolean; parsedCount: number }> {
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
  let lastYieldTime = startTime;

  try {
    while (true) {
      const elapsed = Date.now() - startTime;
      
      // Hard time limit
      if (elapsed > maxTimeMs) {
        console.log(`[M3U] Time limit (${maxTimeMs}ms): parsed ${channels.length} channels`);
        reader.releaseLock();
        return { channels, complete: false, parsedCount: channelIndex };
      }

      // Yield to event loop every 100ms to prevent blocking
      if (Date.now() - lastYieldTime > 100) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYieldTime = Date.now();
      }

      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process lines
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);
        
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          currentChannel = parseExtinfLine(line, channelIndex);
          channelIndex++;
        }
        else if (currentChannel && !line.startsWith('#')) {
          currentChannel.stream_url = line;
          
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

  return { channels, complete: true, parsedCount: channelIndex };
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

  // Fast regex matching
  const nameMatch = line.match(/,\s*(.+)$/);
  if (nameMatch) {
    channel.name = nameMatch[1].trim();
  }

  const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
  if (logoMatch?.[1]) {
    channel.tvg_logo = logoMatch[1];
  }

  const idMatch = line.match(/tvg-id="([^"]*)"/i);
  if (idMatch?.[1]) {
    channel.tvg_id = idMatch[1];
  }

  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  if (tvgNameMatch?.[1]) {
    channel.tvg_name = tvgNameMatch[1];
  }

  const categoryMatch = line.match(/group-title="([^"]*)"/i);
  if (categoryMatch?.[1]) {
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
    
    if (cached) {
      // If cache has enough data or is complete
      if (cached.complete || offset + effectiveLimit <= cached.channels.length) {
        const paginatedChannels = cached.channels.slice(offset, offset + effectiveLimit);
        const hasMore = cached.complete 
          ? (offset + effectiveLimit < cached.channels.length)
          : true;

        console.log(`[M3U] Cache response in ${Date.now() - startTime}ms`);

        return new Response(
          JSON.stringify({
            channels: paginatedChannels,
            total: cached.complete ? cached.channels.length : Math.max(cached.channels.length * 2, 100000),
            offset,
            limit: effectiveLimit,
            hasMore,
            cached: true,
            partial: !cached.complete,
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
      
      // Cache exists but not enough data for this offset
      // Return what we have with retry indication
      if (offset > 0 && !cached.complete) {
        console.log(`[M3U] Cache partial, offset ${offset} exceeds ${cached.channels.length}`);
        return new Response(
          JSON.stringify({
            channels: [],
            total: cached.channels.length,
            offset,
            limit: effectiveLimit,
            hasMore: true,
            cached: true,
            partial: true,
            retryAfter: 3, // Client should retry in 3 seconds
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For offset > 0 without cache, tell client to retry
    // This prevents CPU-intensive full parses for every paginated request
    if (offset > 0 && !cached) {
      console.log(`[M3U] No cache for offset ${offset}, requesting retry`);
      return new Response(
        JSON.stringify({
          channels: [],
          total: 0,
          offset,
          limit: effectiveLimit,
          hasMore: true,
          cached: false,
          partial: true,
          retryAfter: 2, // Client should make offset=0 request first
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Need to fetch (only for offset=0 or cache complete but needs more)
    console.log(`[M3U] Fetching: ${url.substring(0, 60)}...`);
    
    const response = await fetchM3U(url);

    if (!response.ok) {
      throw new Error(`M3U fetch failed: ${response.status} ${response.statusText}`);
    }

    // Parse with time limit
    const { channels, complete, parsedCount } = await parseM3UWithTimeLimit(
      response, 
      CONFIG.MAX_PARSE_TIME_MS
    );
    
    console.log(`[M3U] Parsed ${channels.length} channels (total lines: ${parsedCount}) in ${Date.now() - startTime}ms (complete: ${complete})`);
    
    // Cache what we have
    setCache(url, channels, complete);
    
    const paginatedChannels = channels.slice(offset, offset + effectiveLimit);
    
    // Estimate total if not complete
    const estimatedTotal = complete 
      ? channels.length 
      : Math.max(channels.length * 3, parsedCount * 2, 100000);

    const result: ParseResult = {
      channels: paginatedChannels,
      total: estimatedTotal,
      offset,
      limit: effectiveLimit,
      hasMore: channels.length > offset + effectiveLimit || !complete,
      cached: false,
      partial: !complete,
    };

    console.log(`[M3U] Response in ${Date.now() - startTime}ms: ${paginatedChannels.length} channels`);

    // If not complete, try to continue parsing in background
    if (!complete) {
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            console.log('[M3U] Background: continuing parse...');
            const bgResponse = await fetchM3U(url);
            if (bgResponse.ok) {
              // Allow more time in background but still limit
              const { channels: allChannels, complete: bgComplete } = await parseM3UWithTimeLimit(
                bgResponse,
                45000 // 45s in background
              );
              setCache(url, allChannels, bgComplete);
              console.log(`[M3U] Background: ${allChannels.length} channels (complete: ${bgComplete})`);
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
