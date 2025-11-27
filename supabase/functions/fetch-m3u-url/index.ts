import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Channel {
  id: string;
  name: string;
  tvg_logo: string | null;
  stream_url: string;
  category_name: string;
}

// Parse M3U content in chunks to avoid memory issues
const parseM3UStream = async (response: Response): Promise<Channel[]> => {
  const channels: Channel[] = [];
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) throw new Error('No stream available');
  
  let buffer = '';
  let currentChannel: Partial<Channel> | null = null;
  let channelCount = 0;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('#EXTINF:')) {
          currentChannel = {
            id: `channel-${channelCount++}`,
            name: '',
            tvg_logo: null,
            stream_url: '',
            category_name: 'Outros'
          };
          
          // Extract channel name (after last comma)
          const nameMatch = trimmedLine.match(/,(.+)$/);
          if (nameMatch) {
            currentChannel.name = nameMatch[1].trim();
          }
          
          // Extract tvg-logo
          const logoMatch = trimmedLine.match(/tvg-logo="([^"]+)"/);
          if (logoMatch) {
            currentChannel.tvg_logo = logoMatch[1];
          }
          
          // Extract group-title (category)
          const categoryMatch = trimmedLine.match(/group-title="([^"]+)"/);
          if (categoryMatch) {
            currentChannel.category_name = categoryMatch[1];
          }
        } else if (currentChannel && trimmedLine && !trimmedLine.startsWith('#')) {
          currentChannel.stream_url = trimmedLine;
          
          if (currentChannel.name && currentChannel.stream_url) {
            channels.push(currentChannel as Channel);
          }
          
          currentChannel = null;
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.trim() && currentChannel && currentChannel.name) {
      currentChannel.stream_url = buffer.trim();
      channels.push(currentChannel as Channel);
    }
  } finally {
    reader.releaseLock();
  }
  
  return channels;
};

// Timeout helper - increased to 55 seconds for large files
const fetchWithTimeout = async (url: string, timeoutMs = 55000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; M3U-Fetcher/1.0)',
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, limit, offset = 0 } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FetchM3U] Fazendo fetch da URL: ${url} (limit: ${limit || 'all'}, offset: ${offset})`);
    
    // Fetch com timeout de 55 segundos para listas grandes
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Falha ao buscar M3U: ${response.status} ${response.statusText}`);
    }

    console.log(`[FetchM3U] Parseando M3U em streaming...`);
    
    // Parse M3U in streaming mode to avoid memory issues
    const allChannels = await parseM3UStream(response);
    
    console.log(`[FetchM3U] ${allChannels.length} canais parseados no total`);

    // Se limit for especificado, aplicar paginação
    let resultChannels = allChannels;
    let hasMore = false;
    
    if (limit && limit > 0) {
      resultChannels = allChannels.slice(offset, offset + limit);
      hasMore = (offset + limit) < allChannels.length;
      console.log(`[FetchM3U] Retornando ${resultChannels.length} canais (${offset} a ${offset + resultChannels.length})`);
    } else {
      console.log(`[FetchM3U] Retornando todos os ${allChannels.length} canais`);
    }

    return new Response(
      JSON.stringify({ 
        channels: resultChannels,
        total: allChannels.length,
        offset,
        limit: limit || allChannels.length,
        hasMore
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('[FetchM3U] Erro:', error);
    
    const errorMessage = error.name === 'AbortError' 
      ? 'Timeout ao buscar URL M3U (máximo 55 segundos)'
      : error.message || 'Erro ao buscar URL M3U';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
