import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Helper to log security events
async function logSecurityEvent(
  supabase: any,
  eventType: string,
  severity: string,
  ipAddress: string,
  userId: string | undefined,
  details: any
) {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity,
      ip_address: ipAddress,
      user_id: userId,
      event_details: details
    });
  } catch (error) {
    console.error('[Security] Failed to log event:', error);
  }
}

// Helper to check if IP is blocked
async function checkIPBlocked(supabase: any, ipAddress: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('id')
      .eq('ip_address', ipAddress)
      .is('unblocked_at', null)
      .or('expires_at.is.null,expires_at.gt.now()')
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const syncRequestSchema = z.object({
  mac: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "MAC address inválido"),
  clienteNome: z.string().trim().min(2).max(200),
  clienteId: z.string().uuid().optional(), // ID do cliente para buscar listas
  m3uListIds: z.array(z.string().uuid()).optional(), // IDs das listas M3U selecionadas
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawAuth = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = rawAuth?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Create service role client for admin operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create client with user's JWT for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[smartone-sync] Auth error:', userError);
      
      await logSecurityEvent(
        supabaseService,
        'unauthorized_access',
        'warning',
        clientIp,
        undefined,
        { endpoint: 'smartone-sync', reason: 'invalid_token', error: userError?.message }
      );

      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin usando RPC call com uid
    const { data: isAdmin, error: roleError } = await supabaseService
      .rpc('is_admin', { uid: user.id });

    if (roleError || !isAdmin) {
      // Log unauthorized admin access attempt (no PII)
      await logSecurityEvent(
        supabaseService,
        'unauthorized_access',
        'warning',
        clientIp,
        user.id,
        { endpoint: 'smartone-sync', reason: 'not_admin' }
      );

      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas administradores.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if IP is blocked
    const isBlocked = await checkIPBlocked(supabaseService, clientIp);
    if (isBlocked) {
      await logSecurityEvent(
        supabaseService,
        'unauthorized_access',
        'critical',
        clientIp,
        user.id,
        { endpoint: 'smartone-sync', reason: 'blocked_ip' }
      );

      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 30 requests per minute per user (higher for admins)

    const windowStart = new Date();
    windowStart.setSeconds(0, 0);
    
    const { data: existing } = await supabaseService
      .from('rate_limit_tracking')
      .select('request_count')
      .eq('identifier', user.id)
      .eq('endpoint', 'smartone-sync')
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = existing?.request_count || 0;
    const rateLimit = 30;

    if (currentCount >= rateLimit) {
      return new Response(
        JSON.stringify({ 
          error: 'Taxa de requisições excedida. Tente novamente em alguns minutos.',
          retryAfter: 60 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    await supabaseService
      .from('rate_limit_tracking')
      .upsert({
        identifier: user.id,
        endpoint: 'smartone-sync',
        request_count: currentCount + 1,
        window_start: windowStart.toISOString()
      }, {
        onConflict: 'identifier,endpoint,window_start'
      });

    const body = await req.json();
    const validated = syncRequestSchema.parse(body);
    const { mac, clienteNome, clienteId, m3uListIds: requestM3uListIds } = validated;

    const SMARTONE_API_BASE_URL = Deno.env.get('SMARTONE_API_BASE_URL');
    const SMARTONE_CLIENT_API = Deno.env.get('SMARTONE_CLIENT_API');
    const SMARTONE_KEY_API = Deno.env.get('SMARTONE_KEY_API');

    if (!SMARTONE_API_BASE_URL || !SMARTONE_CLIENT_API || !SMARTONE_KEY_API) {
      console.error('[smartone-sync] Credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração do SmartOne incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar quais listas M3U usar
    let m3uListIds: string[] = [];

    // 1. Prioridade: usar listas específicas fornecidas na requisição
    if (requestM3uListIds && requestM3uListIds.length > 0) {
      m3uListIds = requestM3uListIds;
      console.log('[smartone-sync] Usando listas fornecidas na requisição:', m3uListIds.length);
    } 
    // 2. Segunda prioridade: buscar listas atribuídas ao cliente
    else if (clienteId) {
      const { data: clientLists, error: clientListsError } = await supabaseService
        .from('client_m3u_lists')
        .select('m3u_list_id')
        .eq('client_id', clienteId)
        .eq('is_active', true);
      
      if (!clientListsError && clientLists && clientLists.length > 0) {
        m3uListIds = clientLists.map(cl => cl.m3u_list_id);
        console.log('[smartone-sync] Usando listas do cliente:', m3uListIds.length);
      }
    }

    // 3. Fallback: buscar lista baseada no plano do cliente
    if (m3uListIds.length === 0) {
      const { data: clienteData } = await supabaseService
        .from('clientes')
        .select('situacao, plano')
        .eq('mac_smart_one', mac)
        .maybeSingle();

      if (clienteData?.plano && clienteData?.situacao) {
        const { data: listId } = await supabaseService
          .rpc('get_m3u_for_client_plan', {
            cliente_plano: clienteData.plano,
            cliente_situacao: clienteData.situacao,
          });

        if (listId) {
          m3uListIds = [listId];
          console.log('[smartone-sync] Usando lista do plano do cliente');
        }
      }
    }

    // 4. Último fallback: lista padrão
    if (m3uListIds.length === 0) {
      const { data: defaultList } = await supabaseService
        .from('m3u_lists')
        .select('id')
        .eq('is_default', true)
        .eq('status', 'active')
        .maybeSingle();

      if (defaultList) {
        m3uListIds = [defaultList.id];
        console.log('[smartone-sync] Usando lista padrão');
      }
    }

    // Verificar se encontrou pelo menos uma lista
    if (m3uListIds.length === 0) {
      console.error('[smartone-sync] Nenhuma lista M3U disponível');
      return new Response(
        JSON.stringify({ error: 'Nenhuma lista M3U disponível' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sincronizar TODAS as listas M3U
    const syncResults = [];
    
    for (const listId of m3uListIds) {
      try {
        const { data: m3uList, error: dbError } = await supabaseService
          .from('m3u_lists')
          .select('file_url, name')
          .eq('id', listId)
          .single();

        if (dbError || !m3uList) {
          console.error(`[smartone-sync] M3U list ${listId} not found:`, dbError);
          syncResults.push({
            m3uListId: listId,
            success: false,
            error: 'Lista M3U não encontrada',
          });
          continue;
        }

        // Nome da playlist: "Cliente - Lista"
        const playlistName = `${clienteNome} - ${m3uList.name}`;
        console.log(`[smartone-sync] Criando playlist: ${playlistName}`);

        // Passo 1: Fazer login no SmartOne para obter cookies de sessão
        const SMARTONE_LOGIN_EMAIL = Deno.env.get('SMARTONE_LOGIN_EMAIL');
        const SMARTONE_LOGIN_PASSWORD = Deno.env.get('SMARTONE_LOGIN_PASSWORD');

        if (!SMARTONE_LOGIN_EMAIL || !SMARTONE_LOGIN_PASSWORD) {
          console.error('[smartone-sync] Credenciais de login não configuradas');
          syncResults.push({
            m3uListId: listId,
            success: false,
            error: 'Credenciais de login SmartOne não configuradas',
          });
          continue;
        }

        let sessionCookies = '';
        let csrfToken = '';

        try {
          // Obter página de login para pegar CSRF token inicial
          console.log('[smartone-sync] Obtendo página de login...');
          const loginPageResponse = await fetch(`${SMARTONE_API_BASE_URL}/client/login/`, {
            method: 'GET',
          });

          // Capturar cookies da página de login
          const loginPageCookies = loginPageResponse.headers.get('set-cookie') || '';
          sessionCookies = loginPageCookies.split(';')[0]; // Pegar primeiro cookie

          const loginPageHtml = await loginPageResponse.text();
          const loginCsrfMatch = loginPageHtml.match(/name="_csrf_token"\s+value="([^"]+)"/);
          
          if (loginCsrfMatch && loginCsrfMatch[1]) {
            csrfToken = loginCsrfMatch[1];
            console.log('[smartone-sync] CSRF token de login obtido');
          }

          // Fazer login
          console.log('[smartone-sync] Fazendo login...');
          const loginFormData = new URLSearchParams({
            _csrf_token: csrfToken,
            username: SMARTONE_LOGIN_EMAIL,
            password: SMARTONE_LOGIN_PASSWORD,
          });

          const loginResponse = await fetch(`${SMARTONE_API_BASE_URL}/client/login/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': sessionCookies,
            },
            body: loginFormData.toString(),
            redirect: 'manual', // Não seguir redirecionamentos automaticamente
          });

          // Capturar cookies de sessão autenticada
          const authCookies = loginResponse.headers.get('set-cookie');
          if (authCookies) {
            sessionCookies = authCookies.split(',').map(c => c.split(';')[0]).join('; ');
            console.log('[smartone-sync] Login bem-sucedido, cookies de sessão obtidos');
          }

          // Obter página de add_playlist autenticada para pegar CSRF token válido
          console.log('[smartone-sync] Obtendo CSRF token autenticado...');
          const addPlaylistPageResponse = await fetch(
            `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/add_playlist/`,
            {
              method: 'GET',
              headers: {
                'Cookie': sessionCookies,
              },
            }
          );

          const addPlaylistHtml = await addPlaylistPageResponse.text();
          
          // Tentar múltiplos padrões de regex para capturar CSRF token
          let csrfMatch = addPlaylistHtml.match(/name="_csrf_token"\s+value="([^"]+)"/);
          if (!csrfMatch) {
            csrfMatch = addPlaylistHtml.match(/name='_csrf_token'\s+value='([^']+)'/);
          }
          if (!csrfMatch) {
            csrfMatch = addPlaylistHtml.match(/_csrf_token['"]\s*value=["']([^"']+)["']/);
          }
          
          if (csrfMatch && csrfMatch[1]) {
            csrfToken = csrfMatch[1];
            console.log('[smartone-sync] CSRF token autenticado obtido:', csrfToken.substring(0, 20) + '...');
          } else {
            console.error('[smartone-sync] CSRF token não encontrado na página autenticada');
            console.log('[smartone-sync] HTML snippet:', addPlaylistHtml.substring(0, 500));
          }

        } catch (authError) {
          console.error('[smartone-sync] Erro na autenticação:', authError);
          syncResults.push({
            m3uListId: listId,
            success: false,
            error: 'Falha na autenticação SmartOne',
          });
          continue;
        }

        // Passo 2: Criar playlist usando sessão autenticada com campos corretos
        const formBody = new URLSearchParams({
          _csrf_token: csrfToken,
          form_action: 'generate_xtream_playlist',
          mac: mac,
          xtream_name: playlistName,
          xtream_playlist: m3uList.file_url,
          note: `Auto-sync ${new Date().toISOString()}`,
        });
        
        console.log('[smartone-sync] FormData sendo enviado:', {
          csrf_preview: csrfToken.substring(0, 20) + '...',
          form_action: 'generate_xtream_playlist',
          mac: mac,
          xtream_name: playlistName,
          xtream_playlist_preview: m3uList.file_url.substring(0, 50) + '...',
        });
        
        console.log('[smartone-sync] Enviando requisição de criação de playlist...');
        const smartoneResponse = await fetch(
          `${SMARTONE_API_BASE_URL}/plugin/smart_one/client_main/add_playlist/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': sessionCookies,
            },
            body: formBody.toString(),
          }
        );

        const responseText = await smartoneResponse.text();
        let responseData;
        
        console.log('[smartone-sync] Status da resposta:', smartoneResponse.status);
        console.log('[smartone-sync] Resposta SmartOne (primeiros 200 chars):', responseText.substring(0, 200));
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Se não for JSON, pode ser HTML de sucesso ou erro
          const isSuccess = smartoneResponse.ok && !responseText.includes('error') && !responseText.includes('Error');
          responseData = { 
            success: isSuccess, 
            error: isSuccess ? null : 'Resposta não-JSON do SmartOne',
            raw_response: responseText.substring(0, 500)
          };
        }

        syncResults.push({
          m3uListId: listId,
          m3uListName: m3uList.name,
          playlistName: playlistName,
          success: smartoneResponse.ok && responseData.success !== false,
          statusCode: smartoneResponse.status,
          response: responseData,
        });

        console.log(`[smartone-sync] Resultado para ${playlistName}:`, {
          success: smartoneResponse.ok,
          status: smartoneResponse.status,
        });

      } catch (error) {
        console.error(`[smartone-sync] Erro ao sincronizar lista ${listId}:`, error);
        syncResults.push({
          m3uListId: listId,
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    // Retornar resultado agregado
    const allSuccess = syncResults.every(r => r.success);
    const successCount = syncResults.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess 
          ? `${successCount} playlist(s) criada(s) com sucesso` 
          : `${successCount} de ${syncResults.length} playlist(s) criada(s)`,
        results: syncResults,
        totalLists: syncResults.length,
        successCount: successCount,
        failedCount: syncResults.length - successCount,
      }),
      { 
        status: allSuccess ? 200 : 207, // 207 Multi-Status para sucesso parcial
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[smartone-sync] Error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: error.errors.map(e => e.message) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
