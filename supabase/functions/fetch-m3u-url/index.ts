/**
 * ============================================================================
 * M3U Playlist Fetcher & Parser - Production Grade v3.0
 * ============================================================================
 * 
 * Otimizado para playlists grandes (200k+ canais):
 * - Cache em memória durante a sessão
 * - Parse único + paginação via cache
 * - Fallback HTTPS → HTTP automático
 * 
 * @version 3.0.0
 */

// =============================================================================
// CORS HEADERS
// =============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

// =============================================================================
// CONFIGURATION
// =============================================================================
const CONFIG = {
  FETCH_TIMEOUT_MS: 120000,  // 2 min para listas muito grandes
  DEFAULT_LIMIT: 1000,       // Canais por página default
  CACHE_TTL_MS: 300000,      // 5 min cache
} as const;

// =============================================================================
// IN-MEMORY CACHE (per instance)
// =============================================================================
interface CacheEntry {
  channels: Channel[];
  timestamp: number;
  url: string;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(url: string): string {
  // Use URL without credentials as cache key
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function getFromCache(url: string): Channel[] | null {
  const key = getCacheKey(url);
  const entry = cache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_TTL_MS) {
    console.log(`[M3U] Cache HIT: ${entry.channels.length} channels`);
    return entry.channels;
  }
  
  return null;
}

function setCache(url: string, channels: Channel[]): void {
  const key = getCacheKey(url);
  cache.set(key, {
    channels,
    timestamp: Date.now(),
    url,
  });
  console.log(`[M3U] Cache SET: ${channels.length} channels`);
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
}

// =============================================================================
// M3U STREAMING PARSER
// =============================================================================
async function parseM3UStream(response: Response): Promise<Channel[]> {
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
    reader.releaseLock();
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

  try {
    const body = await req.json();
    const { url, limit, offset = 0 } = body;

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveLimit = limit || CONFIG.DEFAULT_LIMIT;
    
    console.log(`[M3U] Request: limit=${effectiveLimit}, offset=${offset}`);

    // Try to get from cache first
    let allChannels = getFromCache(url);
    let fromCache = false;

    if (!allChannels) {
      console.log(`[M3U] Fetching: ${url.substring(0, 60)}...`);
      
      const response = await fetchM3U(url);

      if (!response.ok) {
        throw new Error(`M3U fetch failed: ${response.status} ${response.statusText}`);
      }

      console.log('[M3U] Parsing full playlist...');
      allChannels = await parseM3UStream(response);
      console.log(`[M3U] Parsed ${allChannels.length} channels total`);
      
      // Cache for future requests
      setCache(url, allChannels);
    } else {
      fromCache = true;
    }

    const total = allChannels.length;
    const paginatedChannels = allChannels.slice(offset, offset + effectiveLimit);
    const hasMore = offset + effectiveLimit < total;

    console.log(`[M3U] Returning ${paginatedChannels.length} channels (${offset}-${offset + paginatedChannels.length} of ${total}) ${fromCache ? '[CACHED]' : ''}`);

    const result: ParseResult = {
      channels: paginatedChannels,
      total,
      offset,
      limit: effectiveLimit,
      hasMore,
      cached: fromCache,
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('abort') || message.includes('timeout');
    
    console.error(`[M3U] Error: ${message}`);

    return new Response(
      JSON.stringify({ 
        error: isTimeout 
          ? 'M3U fetch timeout (max 2min)' 
          : message 
      }),
      { 
        status: isTimeout ? 504 : 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      }
    );
  }
});
