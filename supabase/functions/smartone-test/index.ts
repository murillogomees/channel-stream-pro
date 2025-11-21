import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sdvyxdghxqmntyoweqbd.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[smartone-test] ===== Nova requisição recebida =====');
  console.log('[smartone-test] Método:', req.method);
  console.log('[smartone-test] URL:', req.url);

  try {
    // Extract and validate token
    const rawAuth = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = rawAuth?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Token de autenticação não fornecido',
          auth_valid: false,
          latency_ms: Date.now() - startTime
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Validate user authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Token inválido ou expirado',
          auth_valid: false,
          details: userError?.message,
          latency_ms: Date.now() - startTime
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin, error: roleError } = await supabaseService
      .rpc('is_admin', { uid: user.id });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Acesso negado: permissões de administrador necessárias',
          auth_valid: true,
          is_admin: false,
          latency_ms: Date.now() - startTime
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check SmartOne API configuration
    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API');
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API');
    
    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Configuração do SmartOne incompleta',
          auth_valid: true,
          is_admin: true,
          smartone_configured: false,
          missing_config: {
            api_url: !SMARTONE_API_BASE_URL,
            client_api: !SMARTONE_CLIENT_API,
            api_key: !SMARTONE_KEY_API
          },
          latency_ms: Date.now() - startTime
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body to check if this is a playlist test or healthcheck
    const body = await req.json().catch(() => ({}));
    const { action, playlist } = body;

    // If action is provided, perform playlist operation test
    if (action && playlist) {
      console.log(`[smartone-test] Testing ${action} operation for playlist:`, playlist.nome);

      const testStart = Date.now();
      let result;

      try {
        if (action === 'create') {
          console.log('[smartone-test] Iniciando teste de criação de playlist');
          console.log('[smartone-test] Dados:', {
            mac: playlist.mac,
            nome: playlist.nome,
            m3u_url: playlist.m3u_url?.substring(0, 50) + '...'
          });

          // Test creating a playlist
          const smartoneResponse = await fetch(`${SMARTONE_API_BASE_URL}/playlist/create`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              client_api: SMARTONE_CLIENT_API,
              key_api: SMARTONE_KEY_API,
              mac: playlist.mac,
              m3u_url: playlist.m3u_url,
              name: playlist.nome,
            }),
          });

          console.log('[smartone-test] Status da resposta:', smartoneResponse.status);

          const responseText = await smartoneResponse.text();
          console.log('[smartone-test] Resposta recebida:', responseText.substring(0, 200));
          
          let smartoneData;
          
          try {
            smartoneData = JSON.parse(responseText);
          } catch (parseError) {
            console.error('[smartone-test] Erro ao fazer parse da resposta:', parseError);
            smartoneData = { 
              success: false, 
              error: 'Resposta inválida do SmartOne', 
              raw_response: responseText.substring(0, 500)
            };
          }

          result = {
            success: smartoneResponse.ok && (smartoneData.success === true || smartoneData.status === 'success'),
            playlistId: smartoneData.id || smartoneData.playlist_id || smartoneData.data?.id,
            data: smartoneData,
            latency_ms: Date.now() - testStart,
          };

          console.log('[smartone-test] Resultado do teste:', result.success ? 'SUCESSO' : 'FALHOU');

        } else if (action === 'update') {
          // Test updating a playlist
          const smartoneResponse = await fetch(`${SMARTONE_API_BASE_URL}/playlist/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_api: SMARTONE_CLIENT_API,
              key_api: SMARTONE_KEY_API,
              playlist_id: body.playlistId,
              mac: playlist.mac,
              m3u_url: playlist.m3u_url,
              name: playlist.nome,
            }),
          });

          const responseText = await smartoneResponse.text();
          let smartoneData;
          
          try {
            smartoneData = JSON.parse(responseText);
          } catch {
            smartoneData = { success: false, error: 'Resposta inválida', raw_response: responseText };
          }

          result = {
            success: smartoneResponse.ok && smartoneData.success,
            data: smartoneData,
            latency_ms: Date.now() - testStart,
          };

        } else if (action === 'delete') {
          // Test deleting a playlist
          const smartoneResponse = await fetch(`${SMARTONE_API_BASE_URL}/playlist/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_api: SMARTONE_CLIENT_API,
              key_api: SMARTONE_KEY_API,
              playlist_id: body.playlistId,
              mac: playlist.mac,
            }),
          });

          const responseText = await smartoneResponse.text();
          let smartoneData;
          
          try {
            smartoneData = JSON.parse(responseText);
          } catch {
            smartoneData = { success: false, error: 'Resposta inválida', raw_response: responseText };
          }

          result = {
            success: smartoneResponse.ok && smartoneData.success,
            data: smartoneData,
            latency_ms: Date.now() - testStart,
          };

        } else {
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Ação inválida. Use: create, update ou delete',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[smartone-test] ${action} result:`, result.success ? 'SUCCESS' : 'FAILED');

        return new Response(
          JSON.stringify(result),
          { 
            status: result.success ? 200 : 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      } catch (error) {
        console.error(`[smartone-test] Erro durante ${action}:`, error);
        console.error('[smartone-test] Stack trace:', error.stack);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: error.message || 'Erro desconhecido ao testar playlist',
            error_type: error.name || 'UnknownError',
            details: {
              action,
              playlist_nome: playlist?.nome,
              timestamp: new Date().toISOString()
            },
            latency_ms: Date.now() - testStart,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Default: perform healthcheck
    const smartoneTestStart = Date.now();
    let smartoneStatus = 'unknown';
    let smartoneLatency = 0;
    let smartoneError = null;

    try {
      const testResponse = await fetch(SMARTONE_API_BASE_URL, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${SMARTONE_KEY_API}`
        }
      });
      
      smartoneLatency = Date.now() - smartoneTestStart;
      smartoneStatus = testResponse.ok ? 'online' : 'error';
      
      if (!testResponse.ok) {
        smartoneError = `HTTP ${testResponse.status}`;
      }
    } catch (error) {
      smartoneLatency = Date.now() - smartoneTestStart;
      smartoneStatus = 'offline';
      smartoneError = error.message;
    }

    // Return success with all diagnostic info
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Healthcheck completo',
        auth_valid: true,
        is_admin: true,
        smartone_configured: true,
        smartone_status: smartoneStatus,
        smartone_latency_ms: smartoneLatency,
        smartone_error: smartoneError,
        user_id: user.id,
        user_email: user.email,
        total_latency_ms: Date.now() - startTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[smartone-test] Erro inesperado:', error);
    console.error('[smartone-test] Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro interno do servidor',
        details: error.message,
        error_type: error.name,
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
