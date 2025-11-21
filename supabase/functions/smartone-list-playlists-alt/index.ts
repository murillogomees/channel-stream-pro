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
    console.log('[smartone-list-playlists-alt] ===== Nova requisição (endpoint alternativo) =====');

    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API');
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API');

    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      console.error('[smartone-list-playlists-alt] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração SmartOne incompleta',
          playlists: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tentar endpoints alternativos documentados
    const endpoints = [
      {
        name: 'list_playlists (original)',
        url: `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`,
        method: 'GET'
      },
      {
        name: 'get_playlists (alternativo 1)',
        url: `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/get_playlists/`,
        method: 'GET'
      },
      {
        name: 'playlists (alternativo 2)',
        url: `${SMARTONE_API_BASE_URL}/api/playlists`,
        method: 'GET'
      },
      {
        name: 'list_playlists POST (alternativo 3)',
        url: `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`,
        method: 'POST'
      }
    ];

    const results = [];

    for (const endpoint of endpoints) {
      console.log(`[smartone-list-playlists-alt] Testando endpoint: ${endpoint.name}`);
      
      const startTime = Date.now();
      
      try {
        const options: RequestInit = {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Client-API': SMARTONE_CLIENT_API,
            'X-Key-API': SMARTONE_KEY_API,
            'client_api': SMARTONE_CLIENT_API,
            'key_api': SMARTONE_KEY_API,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://smartone-iptv.com/',
            'Origin': 'https://smartone-iptv.com'
          }
        };

        // Para POST, adicionar body com credenciais
        if (endpoint.method === 'POST') {
          options.body = JSON.stringify({
            client_api: SMARTONE_CLIENT_API,
            key_api: SMARTONE_KEY_API
          });
        }

        const response = await fetch(endpoint.url, options);
        const latency = Date.now() - startTime;

        const responseText = await response.text();
        const isJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');
        const isHtml = responseText.includes('<!DOCTYPE') || responseText.includes('<html');

        let parsedData = null;
        if (isJson) {
          try {
            parsedData = JSON.parse(responseText);
          } catch (e) {
            console.error(`[smartone-list-playlists-alt] Erro parse JSON ${endpoint.name}:`, e);
          }
        }

        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          status: response.status,
          latency_ms: latency,
          is_json: isJson,
          is_html: isHtml,
          blocked_by_cloudflare: response.status === 403 || isHtml,
          success: response.status === 200 && isJson && !isHtml,
          data: parsedData,
          preview: responseText.substring(0, 300)
        });

        console.log(`[smartone-list-playlists-alt] ${endpoint.name}: status=${response.status}, json=${isJson}, html=${isHtml}`);

        // Se encontrou um endpoint que funciona, retornar imediatamente
        if (response.status === 200 && isJson && !isHtml && parsedData) {
          console.log(`[smartone-list-playlists-alt] ✅ Endpoint ${endpoint.name} funcionou!`);
          return new Response(
            JSON.stringify({
              success: true,
              playlists: parsedData.playlists || parsedData.data || (Array.isArray(parsedData) ? parsedData : []),
              working_endpoint: endpoint.name,
              working_url: endpoint.url,
              working_method: endpoint.method,
              latency_ms: latency,
              all_results: results
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      } catch (error: any) {
        console.error(`[smartone-list-playlists-alt] Erro ${endpoint.name}:`, error.message);
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          error: error.message,
          success: false
        });
      }

      // Pequeno delay entre tentativas
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Nenhum endpoint funcionou
    console.error('[smartone-list-playlists-alt] ❌ Nenhum endpoint funcionou');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Nenhum endpoint alternativo funcionou. Todos foram bloqueados ou retornaram HTML.',
        playlists: [],
        all_results: results,
        recommendation: 'Acesse o painel SmartOne manualmente ou entre em contato com o suporte do SmartOne para obter a documentação oficial da API.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[smartone-list-playlists-alt] Erro não tratado:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao testar endpoints alternativos',
        playlists: []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
