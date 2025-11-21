import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[smartone-xtream-api] ===== Requisição Xtream Codes API =====');

    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API'); // username
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API'); // password

    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais SmartOne não configuradas',
          playlists: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action = 'user_info' } = await req.json().catch(() => ({}));

    // Construir URL da API Xtream Codes
    // Formato: http://url:port/player_api.php?username=XXX&password=XXX&action=ACTION
    const apiUrl = new URL(`${SMARTONE_API_BASE_URL}/player_api.php`);
    apiUrl.searchParams.set('username', SMARTONE_CLIENT_API);
    apiUrl.searchParams.set('password', SMARTONE_KEY_API);
    
    if (action !== 'user_info') {
      apiUrl.searchParams.set('action', action);
    }

    console.log('[smartone-xtream-api] URL:', apiUrl.toString().replace(SMARTONE_CLIENT_API, 'XXX').replace(SMARTONE_KEY_API, 'XXX'));
    console.log('[smartone-xtream-api] Action:', action);

    const startTime = Date.now();
    
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    const latency = Date.now() - startTime;
    console.log('[smartone-xtream-api] Status:', response.status);
    console.log('[smartone-xtream-api] Latência:', latency, 'ms');

    const responseText = await response.text();
    console.log('[smartone-xtream-api] Resposta (primeiros 500 chars):', responseText.substring(0, 500));

    // Verificar se retornou HTML (bloqueio Cloudflare)
    if (response.status === 403 || responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      console.error('[smartone-xtream-api] Bloqueado por Cloudflare');
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API bloqueada por proteção Cloudflare',
          blocked_by_cloudflare: true,
          latency_ms: latency
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[smartone-xtream-api] Erro ao fazer parse JSON:', parseError);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Resposta inválida da API (não é JSON)',
          raw_response: responseText.substring(0, 500),
          latency_ms: latency
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar resposta de erro da API
    if (data.error || data.message?.includes('error') || data.message?.includes('invalid')) {
      console.error('[smartone-xtream-api] Erro da API:', data);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: data.error || data.message || 'Erro desconhecido da API',
          api_response: data,
          latency_ms: latency
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar resposta baseada na action
    let result;
    
    switch (action) {
      case 'user_info':
        result = {
          success: true,
          user_info: data.user_info || data,
          server_info: data.server_info,
          latency_ms: latency
        };
        break;
        
      case 'get_live_streams':
        result = {
          success: true,
          streams: Array.isArray(data) ? data : [],
          total: Array.isArray(data) ? data.length : 0,
          latency_ms: latency
        };
        break;
        
      case 'get_vod_streams':
        result = {
          success: true,
          vod: Array.isArray(data) ? data : [],
          total: Array.isArray(data) ? data.length : 0,
          latency_ms: latency
        };
        break;
        
      case 'get_series':
        result = {
          success: true,
          series: Array.isArray(data) ? data : [],
          total: Array.isArray(data) ? data.length : 0,
          latency_ms: latency
        };
        break;
        
      default:
        result = {
          success: true,
          data: data,
          latency_ms: latency
        };
    }

    console.log('[smartone-xtream-api] ✅ Sucesso:', action);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[smartone-xtream-api] Erro não tratado:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao acessar API Xtream Codes'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
