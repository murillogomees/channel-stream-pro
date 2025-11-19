import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Timeout helper
const fetchWithTimeout = async (url: string, timeoutMs = 25000) => {
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
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FetchM3U] Fazendo fetch da URL: ${url}`);
    
    // Fetch com timeout de 25 segundos
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Falha ao buscar M3U: ${response.status} ${response.statusText}`);
    }

    // Limitar tamanho máximo para evitar memory issues (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    const contentLength = response.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      throw new Error('Arquivo M3U muito grande (máximo 10MB)');
    }

    const content = await response.text();
    
    // Verificação adicional de tamanho
    if (content.length > MAX_SIZE) {
      throw new Error('Arquivo M3U muito grande (máximo 10MB)');
    }
    
    console.log(`[FetchM3U] Conteúdo obtido com sucesso (${content.length} bytes)`);

    return new Response(
      JSON.stringify({ content }),
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
      ? 'Timeout ao buscar URL M3U (máximo 25 segundos)'
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
