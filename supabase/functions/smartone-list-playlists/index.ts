import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[smartone-list-playlists] ===== Nova requisição =====');

    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API');
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API');

    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      console.error('[smartone-list-playlists] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração SmartOne incompleta',
          playlists: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Endpoint para listar playlists do SmartOne
    const listUrl = `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`;
    
    console.log('[smartone-list-playlists] Fazendo requisição para:', listUrl);

    const startTime = Date.now();
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'client_api': SMARTONE_CLIENT_API,
        'key_api': SMARTONE_KEY_API,
        'User-Agent': 'Lovable-IPTV-Manager/1.0'
      }
    });

    const latency = Date.now() - startTime;
    console.log('[smartone-list-playlists] Status:', response.status);
    console.log('[smartone-list-playlists] Latência:', latency, 'ms');

    const responseText = await response.text();
    console.log('[smartone-list-playlists] Resposta (primeiros 500 chars):', responseText.substring(0, 500));

    // Tentar fazer parse do JSON
    let smartoneData;
    try {
      smartoneData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[smartone-list-playlists] Erro ao fazer parse da resposta:', parseError);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Resposta inválida do SmartOne (não é JSON)',
          raw_response: responseText.substring(0, 500),
          latency_ms: latency,
          playlists: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a resposta foi bem-sucedida
    if (response.status !== 200 || !smartoneData.success) {
      console.error('[smartone-list-playlists] Erro na resposta do SmartOne:', smartoneData);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: smartoneData.error || smartoneData.message || 'Erro ao listar playlists',
          latency_ms: latency,
          playlists: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[smartone-list-playlists] Playlists recuperadas:', smartoneData.playlists?.length || 0);

    return new Response(
      JSON.stringify({
        success: true,
        playlists: smartoneData.playlists || smartoneData.data || [],
        latency_ms: latency
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[smartone-list-playlists] Erro não tratado:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao listar playlists do SmartOne',
        playlists: []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
