/**
 * ============================================================================
 * M3U Playlist Fetcher & Parser - Production Grade
 * ============================================================================
 * 
 * Edge function que:
 * - Busca arquivos M3U/M3U8 de URLs externas
 * - Parse streaming para arquivos grandes (200k+ canais)
 * - Suporta paginação para carregamento progressivo
 * - Fallback HTTPS → HTTP automático
 * 
 * @version 2.0.0
 * @author IPTV Link
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
  FETCH_TIMEOUT_MS: 60000,  // 60s para listas grandes
  DEFAULT_LIMIT: 500,       // Canais por página default
} as const;

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
}

// =============================================================================
// M3U STREAMING PARSER
// =============================================================================

/**
 * Parse M3U content em streaming com early termination
 * Para de parsear assim que tiver canais suficientes (offset + limit)
 * Isso evita parsear 200k+ canais quando só precisamos de 300
 */
async function parseM3UStream(
  response: Response, 
  targetCount: number = Infinity
): Promise<{ channels: Channel[]; reachedEnd: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Stream not available');
  }

  const decoder = new TextDecoder();
  const channels: Channel[] = [];
  
  let buffer = '';
  let currentChannel: Partial<Channel> | null = null;
  let channelIndex = 0;
  let reachedEnd = true;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      // Append chunk to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Split into lines
      const lines = buffer.split('\n');
      
      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) continue;

        // #EXTINF line = start of new channel
        if (trimmed.startsWith('#EXTINF:')) {
          currentChannel = parseExtinfLine(trimmed, channelIndex++);
        }
        // URL line (not a comment) = channel URL
        else if (currentChannel && !trimmed.startsWith('#')) {
          currentChannel.stream_url = trimmed;
          
          // Channel complete - add to list
          if (currentChannel.name && currentChannel.stream_url) {
            channels.push(currentChannel as Channel);
            
            // Early termination: stop if we have enough channels
            if (channels.length >= targetCount) {
              console.log(`[M3U] Early termination at ${channels.length} channels`);
              reachedEnd = false;
              return { channels, reachedEnd };
            }
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
    reader.releaseLock();
  }

  return { channels, reachedEnd };
}

/**
 * Parse uma linha #EXTINF extraindo metadados
 * 
 * Formato: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name
 */
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

  // Extract channel name (after last comma)
  const nameMatch = line.match(/,\s*(.+)$/);
  if (nameMatch) {
    channel.name = nameMatch[1].trim();
  }

  // Extract tvg-logo
  const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
  if (logoMatch && logoMatch[1]) {
    channel.tvg_logo = logoMatch[1];
  }

  // Extract tvg-id
  const idMatch = line.match(/tvg-id="([^"]*)"/i);
  if (idMatch && idMatch[1]) {
    channel.tvg_id = idMatch[1];
  }

  // Extract tvg-name
  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  if (tvgNameMatch && tvgNameMatch[1]) {
    channel.tvg_name = tvgNameMatch[1];
  }

  // Extract group-title (category)
  const categoryMatch = line.match(/group-title="([^"]*)"/i);
  if (categoryMatch && categoryMatch[1]) {
    channel.category_name = categoryMatch[1];
  }

  return channel;
}

// =============================================================================
// HTTP FETCHING
// =============================================================================

/**
 * Fetch com timeout e fallback HTTPS → HTTP
 */
async function fetchM3U(url: string): Promise<Response> {
  let urlToFetch = url;
  
  // Primeira tentativa
  try {
    return await fetchWithTimeout(urlToFetch);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    
    // Fallback para HTTP se HTTPS falhar com erro TLS
    if (urlToFetch.startsWith('https://') && isTlsError(message)) {
      console.log('[M3U] HTTPS failed, trying HTTP...');
      urlToFetch = urlToFetch.replace('https://', 'http://');
      return await fetchWithTimeout(urlToFetch);
    }
    
    throw error;
  }
}

/**
 * Fetch com timeout
 */
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

/**
 * Verifica se é erro de TLS
 */
function isTlsError(message: string): boolean {
  const indicators = ['tls', 'ssl', 'certificate', 'handshake', 'corrupt', 'InvalidContentType'];
  const lower = message.toLowerCase();
  return indicators.some(i => lower.includes(i.toLowerCase()));
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
    // Parse request body
    const body = await req.json();
    const { url, limit, offset = 0 } = body;

    // Validação
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveLimit = limit || CONFIG.DEFAULT_LIMIT;
    
    console.log(`[M3U] Fetching: ${url.substring(0, 80)}... (limit: ${effectiveLimit}, offset: ${offset})`);

    // Fetch M3U
    const response = await fetchM3U(url);

    if (!response.ok) {
      throw new Error(`M3U fetch failed: ${response.status} ${response.statusText}`);
    }

    // Calculate how many channels we need to parse (offset + limit)
    const targetCount = offset + effectiveLimit;
    
    console.log(`[M3U] Parsing stream (target: ${targetCount} channels)...`);

    // Parse em streaming with early termination
    const { channels: parsedChannels, reachedEnd } = await parseM3UStream(response, targetCount);

    console.log(`[M3U] Parsed ${parsedChannels.length} channels`);

    // Aplicar paginação (slice from offset)
    const paginatedChannels = parsedChannels.slice(offset);
    
    // hasMore is true if we hit early termination OR if there are more channels after our slice
    const hasMore = !reachedEnd || parsedChannels.length > offset + effectiveLimit;

    console.log(`[M3U] Returning ${paginatedChannels.length} channels (offset: ${offset})`);

    const result: ParseResult = {
      channels: paginatedChannels,
      total: reachedEnd ? parsedChannels.length : -1, // -1 indicates unknown total (early termination)
      offset,
      limit: effectiveLimit,
      hasMore,
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
          ? 'M3U fetch timeout (max 60s)' 
          : message 
      }),
      { 
        status: isTimeout ? 504 : 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      }
    );
  }
});
