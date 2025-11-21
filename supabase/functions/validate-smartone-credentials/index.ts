import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validar autenticação
    const rawAuth = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = rawAuth?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar credenciais
    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API');
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API');

    const validationResults = {
      credentials_configured: true,
      api_base_url: {
        configured: !!SMARTONE_API_BASE_URL,
        value: SMARTONE_API_BASE_URL ? `${SMARTONE_API_BASE_URL.substring(0, 30)}...` : null,
        masked: true
      },
      client_api: {
        configured: !!SMARTONE_CLIENT_API,
        value: SMARTONE_CLIENT_API ? `${SMARTONE_CLIENT_API.substring(0, 4)}...${SMARTONE_CLIENT_API.substring(SMARTONE_CLIENT_API.length - 4)}` : null,
        length: SMARTONE_CLIENT_API?.length || 0,
        masked: true
      },
      key_api: {
        configured: !!SMARTONE_KEY_API,
        value: SMARTONE_KEY_API ? `${SMARTONE_KEY_API.substring(0, 4)}...${SMARTONE_KEY_API.substring(SMARTONE_KEY_API.length - 4)}` : null,
        length: SMARTONE_KEY_API?.length || 0,
        masked: true
      }
    };

    // Se alguma credencial não estiver configurada
    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais SmartOne incompletas',
          validation: validationResults,
          missing: {
            api_url: !SMARTONE_API_BASE_URL,
            client_api: !SMARTONE_CLIENT_API,
            key_api: !SMARTONE_KEY_API
          },
          latency_ms: Date.now() - startTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Testar conectividade com múltiplos métodos
    const tests = [];

    // Teste 1: HEAD request simples
    try {
      const headStart = Date.now();
      const headResponse = await fetch(SMARTONE_API_BASE_URL, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      tests.push({
        method: 'HEAD',
        endpoint: SMARTONE_API_BASE_URL,
        status: headResponse.status,
        success: headResponse.status < 400,
        latency_ms: Date.now() - headStart,
        cloudflare_blocked: headResponse.status === 403
      });
    } catch (error: any) {
      tests.push({
        method: 'HEAD',
        endpoint: SMARTONE_API_BASE_URL,
        error: error.message,
        success: false
      });
    }

    // Teste 2: GET com credenciais nos headers
    try {
      const getStart = Date.now();
      const getResponse = await fetch(`${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-API': SMARTONE_CLIENT_API,
          'X-Key-API': SMARTONE_KEY_API,
          'client_api': SMARTONE_CLIENT_API,
          'key_api': SMARTONE_KEY_API,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      const responseText = await getResponse.text();
      const isJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');
      const isHtml = responseText.includes('<!DOCTYPE') || responseText.includes('<html');

      let parsedData = null;
      if (isJson) {
        try {
          parsedData = JSON.parse(responseText);
        } catch (e) {
          // Ignore parse error
        }
      }

      tests.push({
        method: 'GET with credentials',
        endpoint: `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`,
        status: getResponse.status,
        success: getResponse.status === 200 && isJson && !isHtml,
        latency_ms: Date.now() - getStart,
        is_json: isJson,
        is_html: isHtml,
        cloudflare_blocked: getResponse.status === 403 || isHtml,
        has_data: !!parsedData,
        response_preview: responseText.substring(0, 200)
      });
    } catch (error: any) {
      tests.push({
        method: 'GET with credentials',
        endpoint: `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`,
        error: error.message,
        success: false
      });
    }

    // Teste 3: POST com body
    try {
      const postStart = Date.now();
      const postResponse = await fetch(`${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_api: SMARTONE_CLIENT_API,
          key_api: SMARTONE_KEY_API
        })
      });

      const responseText = await postResponse.text();
      const isJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');

      tests.push({
        method: 'POST with body',
        endpoint: `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/list_playlists/`,
        status: postResponse.status,
        success: postResponse.status === 200 && isJson,
        latency_ms: Date.now() - postStart,
        is_json: isJson,
        response_preview: responseText.substring(0, 200)
      });
    } catch (error: any) {
      tests.push({
        method: 'POST with body',
        error: error.message,
        success: false
      });
    }

    // Analisar resultados
    const successfulTests = tests.filter(t => t.success);
    const allTestsFailed = successfulTests.length === 0;
    const cloudflareBlocking = tests.some(t => t.cloudflare_blocked);

    const diagnosis = {
      overall_status: allTestsFailed ? 'failed' : 'partial',
      credentials_valid: !allTestsFailed,
      api_accessible: successfulTests.length > 0,
      cloudflare_blocking: cloudflareBlocking,
      working_methods: successfulTests.map(t => t.method),
      recommendation: cloudflareBlocking 
        ? 'SmartOne está bloqueando requisições automáticas com Cloudflare. Acesse o painel manualmente.'
        : allTestsFailed
        ? 'Verifique se as credenciais estão corretas no painel SmartOne ou entre em contato com o suporte.'
        : 'Credenciais válidas. Alguns endpoints estão acessíveis.'
    };

    return new Response(
      JSON.stringify({
        success: !allTestsFailed,
        validation: validationResults,
        tests: tests,
        diagnosis: diagnosis,
        latency_ms: Date.now() - startTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[validate-smartone-credentials] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        latency_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
