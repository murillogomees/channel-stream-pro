/**
 * ============================================================================
 * M3U Playlist Fetcher & Parser - Optimized v6.0
 * ============================================================================
 * 
 * Otimizações:
 * - Parsing mais rápido com regex otimizados
 * - Cache em memória + persistência no DB
 * - Retorna mais dados na primeira requisição
 * - Background parsing com mais tempo
 * 
 * @version 6.0.0
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

const CONFIG = {
  FETCH_TIMEOUT_MS: 30000,     // 30s timeout
  DEFAULT_LIMIT: 2000,         // Mais dados por padrão
  MAX_LIMIT: 10000,            // Máximo por requisição
  CACHE_TTL_MS: 3600000,       // 1 hora cache
  MAX_PARSE_TIME_MS: 12000,    // 12s de parse na requisição principal
  BG_PARSE_TIME_MS: 55000,     // 55s em background
  DB_CACHE_TTL_HOURS: 24,      // 24h no banco
} as const;

// =============================================================================
// IN-MEMORY CACHE
// =============================================================================
interface CacheEntry {
  channels: Channel[];
  timestamp: number;
  complete: boolean;
}

const memoryCache = new Map<string, CacheEntry>();

function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function getFromMemoryCache(url: string): CacheEntry | null {
  const key = getCacheKey(url);
  const entry = memoryCache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_TTL_MS) {
    return entry;
  }
  
  if (entry) memoryCache.delete(key);
  return null;
}

function setMemoryCache(url: string, channels: Channel[], complete: boolean): void {
  const key = getCacheKey(url);
  memoryCache.set(key, { channels, timestamp: Date.now(), complete });
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
  group_title?: string;
}

// =============================================================================
// FAST STRING PARSER (sem regex onde possível)
// =============================================================================
function parseM3UFast(content: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split('\n');
  let currentChannel: Partial<Channel> | null = null;
  let channelIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentChannel = parseExtinfFast(line, channelIndex);
      channelIndex++;
    } else if (currentChannel && !line.startsWith('#')) {
      currentChannel.stream_url = line;
      if (currentChannel.name && currentChannel.stream_url) {
        channels.push(currentChannel as Channel);
      }
      currentChannel = null;
    }
  }

  return channels;
}

function parseExtinfFast(line: string, index: number): Partial<Channel> {
  const channel: Partial<Channel> = {
    id: `ch-${index}`,
    name: '',
    tvg_logo: null,
    tvg_id: null,
    tvg_name: null,
    stream_url: '',
    category_name: 'Outros',
    group_title: 'Outros',
  };

  // Extract name (after last comma)
  const commaIdx = line.lastIndexOf(',');
  if (commaIdx !== -1) {
    channel.name = line.substring(commaIdx + 1).trim();
  }

  // Fast attribute extraction
  const extractAttr = (attr: string): string | null => {
    const start = line.indexOf(`${attr}="`);
    if (start === -1) return null;
    const valueStart = start + attr.length + 2;
    const valueEnd = line.indexOf('"', valueStart);
    if (valueEnd === -1) return null;
    return line.substring(valueStart, valueEnd);
  };

  channel.tvg_logo = extractAttr('tvg-logo');
  channel.tvg_id = extractAttr('tvg-id');
  channel.tvg_name = extractAttr('tvg-name');
  
  const groupTitle = extractAttr('group-title');
  if (groupTitle) {
    channel.category_name = groupTitle;
    channel.group_title = groupTitle;
  }

  return channel;
}

// =============================================================================
// STREAMING PARSER WITH TIME LIMIT
// =============================================================================
async function parseM3UStreaming(
  response: Response, 
  maxTimeMs: number
): Promise<{ channels: Channel[]; complete: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not available');

  const decoder = new TextDecoder();
  const channels: Channel[] = [];
  
  let buffer = '';
  let currentChannel: Partial<Channel> | null = null;
  let channelIndex = 0;
  const startTime = Date.now();
  let lastYield = startTime;

  try {
    while (true) {
      if (Date.now() - startTime > maxTimeMs) {
        console.log(`[M3U] Time limit: ${channels.length} channels in ${maxTimeMs}ms`);
        return { channels, complete: false };
      }

      // Yield every 50ms
      if (Date.now() - lastYield > 50) {
        await new Promise(r => setTimeout(r, 0));
        lastYield = Date.now();
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIdx).trim();
        buffer = buffer.substring(newlineIdx + 1);
        
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
          currentChannel = parseExtinfFast(line, channelIndex);
          channelIndex++;
        } else if (currentChannel && !line.startsWith('#')) {
          currentChannel.stream_url = line;
          if (currentChannel.name && currentChannel.stream_url) {
            channels.push(currentChannel as Channel);
          }
          currentChannel = null;
        }
      }
    }

    // Process remaining
    if (buffer.trim() && currentChannel && !buffer.trim().startsWith('#')) {
      currentChannel.stream_url = buffer.trim();
      if (currentChannel.name && currentChannel.stream_url) {
        channels.push(currentChannel as Channel);
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  return { channels, complete: true };
}

// =============================================================================
// DATABASE CACHE
// =============================================================================
async function getFromDbCache(supabase: any, url: string): Promise<{ channels: Channel[]; total: number } | null> {
  try {
    const hash = await hashString(url);
    
    const { data, error } = await supabase
      .from('m3u_import_cache')
      .select('channels_data, channel_count, created_at')
      .eq('source_hash', hash)
      .single();

    if (error || !data) return null;

    // Check if expired (24 hours)
    const createdAt = new Date(data.created_at).getTime();
    if (Date.now() - createdAt > CONFIG.DB_CACHE_TTL_HOURS * 60 * 60 * 1000) {
      return null;
    }

    console.log(`[M3U] DB cache hit: ${data.channel_count} channels`);
    return {
      channels: data.channels_data as Channel[],
      total: data.channel_count,
    };
  } catch (err) {
    console.error('[M3U] DB cache read error:', err);
    return null;
  }
}

async function saveToDbCache(supabase: any, url: string, channels: Channel[]): Promise<void> {
  try {
    const hash = await hashString(url);
    
    await supabase
      .from('m3u_import_cache')
      .upsert({
        source_hash: hash,
        source_url: url.substring(0, 500),
        channels_data: channels,
        categories_data: [],
        channel_count: channels.length,
        last_used_at: new Date().toISOString(),
        use_count: 1,
      }, { onConflict: 'source_hash' });

    console.log(`[M3U] Saved ${channels.length} channels to DB cache`);
  } catch (err) {
    console.error('[M3U] DB cache write error:', err);
  }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21',
        'Accept': '*/*',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTlsError(message: string): boolean {
  const indicators = ['tls', 'ssl', 'certificate', 'handshake', 'corrupt', 'InvalidContentType'];
  return indicators.some(i => message.toLowerCase().includes(i.toLowerCase()));
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

    const effectiveLimit = Math.min(limit || CONFIG.DEFAULT_LIMIT, CONFIG.MAX_LIMIT);
    console.log(`[M3U] Request: limit=${effectiveLimit}, offset=${offset}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check memory cache
    const memCached = getFromMemoryCache(url);
    if (memCached && (memCached.complete || memCached.channels.length >= offset + effectiveLimit)) {
      const paginated = memCached.channels.slice(offset, offset + effectiveLimit);
      console.log(`[M3U] Memory cache: ${paginated.length} channels in ${Date.now() - startTime}ms`);
      
      return new Response(
        JSON.stringify({
          channels: paginated,
          total: memCached.channels.length,
          offset,
          limit: effectiveLimit,
          hasMore: offset + effectiveLimit < memCached.channels.length,
          cached: true,
          partial: !memCached.complete,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check DB cache (only for offset=0 to avoid repeated queries)
    if (offset === 0) {
      const dbCached = await getFromDbCache(supabase, url);
      if (dbCached && dbCached.channels.length > 0) {
        // Also set memory cache
        setMemoryCache(url, dbCached.channels, true);
        
        const paginated = dbCached.channels.slice(0, effectiveLimit);
        console.log(`[M3U] DB cache: ${paginated.length}/${dbCached.total} channels in ${Date.now() - startTime}ms`);
        
        return new Response(
          JSON.stringify({
            channels: paginated,
            total: dbCached.total,
            offset: 0,
            limit: effectiveLimit,
            hasMore: effectiveLimit < dbCached.total,
            cached: true,
            partial: false,
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. For offset > 0 without cache, tell client to retry
    if (offset > 0 && !memCached) {
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
          retryAfter: 2,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch and parse
    console.log(`[M3U] Fetching: ${url.substring(0, 60)}...`);
    const response = await fetchM3U(url);

    if (!response.ok) {
      throw new Error(`M3U fetch failed: ${response.status}`);
    }

    const { channels, complete } = await parseM3UStreaming(response, CONFIG.MAX_PARSE_TIME_MS);
    console.log(`[M3U] Parsed ${channels.length} channels (complete: ${complete}) in ${Date.now() - startTime}ms`);
    
    // Cache in memory
    setMemoryCache(url, channels, complete);
    
    const paginated = channels.slice(offset, offset + effectiveLimit);
    const estimatedTotal = complete ? channels.length : Math.max(channels.length * 5, 100000);

    // Background: continue parsing and save to DB
    if (!complete || channels.length > 10000) {
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            console.log('[M3U] Background: full parse...');
            const bgResponse = await fetchM3U(url);
            if (bgResponse.ok) {
              const { channels: allChannels, complete: bgComplete } = await parseM3UStreaming(
                bgResponse,
                CONFIG.BG_PARSE_TIME_MS
              );
              
              setMemoryCache(url, allChannels, bgComplete);
              
              if (bgComplete || allChannels.length > channels.length) {
                await saveToDbCache(supabase, url, allChannels);
              }
              
              console.log(`[M3U] Background: ${allChannels.length} channels saved (complete: ${bgComplete})`);
            }
          } catch (err) {
            console.error('[M3U] Background error:', err);
          }
        })()
      );
    } else {
      // Save small playlists to DB immediately
      EdgeRuntime.waitUntil(saveToDbCache(supabase, url, channels));
    }

    return new Response(
      JSON.stringify({
        channels: paginated,
        total: estimatedTotal,
        offset,
        limit: effectiveLimit,
        hasMore: channels.length > offset + effectiveLimit || !complete,
        cached: false,
        partial: !complete,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('abort') || message.includes('timeout');
    
    console.error(`[M3U] Error: ${message}`);

    return new Response(
      JSON.stringify({ error: isTimeout ? 'M3U fetch timeout' : message }),
      { status: isTimeout ? 504 : 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
