import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // Fazer fetch da URL M3U (permite HTTP e HTTPS)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; M3U-Fetcher/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar M3U: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    
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
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao buscar URL M3U' 
      }),
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
