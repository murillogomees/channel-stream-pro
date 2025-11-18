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
};

const syncRequestSchema = z.object({
  mac: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "MAC address inválido"),
  usuario: z.string().trim().min(3).max(100),
  senha: z.string().trim().min(4).max(100),
  clienteNome: z.string().trim().min(2).max(200),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
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

    console.log('[smartone-sync] User authenticated:', user.id);
    
    // Verificar se é admin usando RPC call com uid
    const { data: isAdmin, error: roleError } = await supabaseService
      .rpc('is_admin', { uid: user.id });

    if (roleError || !isAdmin) {
      console.error('[smartone-sync] Permission denied for user:', user.id, 'roleError:', roleError);
      
      // Log unauthorized admin access attempt
      await logSecurityEvent(
        supabaseService,
        'unauthorized_access',
        'warning',
        clientIp,
        user.id,
        { endpoint: 'smartone-sync', reason: 'not_admin', userId: user.id, roleError: roleError?.message }
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
      console.warn(`[smartone-sync] Rate limit exceeded for user: ${user.id}`);
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
    const { mac, usuario, senha, clienteNome } = validated;

    // Hash sensitive data for logging
    const hashData = async (data: string): Promise<string> => {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 8);
    };

    console.log('[smartone-sync] Request:', { 
      macHash: await hashData(mac),
      userId: user.id,
      timestamp: Date.now()
    });

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

    // Buscar dados do cliente para determinar o plano
    const { data: clienteData, error: clienteError } = await supabaseService
      .from('clientes')
      .select('situacao, plano, mac_smart_one')
      .eq('mac_smart_one', mac)
      .maybeSingle();

    if (clienteError) {
      console.warn('[smartone-sync] Cliente data fetch warning:', clienteError);
    }

    console.log('[smartone-sync] Client plan:', clienteData?.plano, '| Status:', clienteData?.situacao);

    // Buscar a lista M3U apropriada baseada no plano do cliente usando a função SQL
    let m3uListId = null;
    
    if (clienteData?.plano && clienteData?.situacao) {
      const { data: listId, error: rpcError } = await supabaseService
        .rpc('get_m3u_for_client_plan', {
          cliente_plano: clienteData.plano,
          cliente_situacao: clienteData.situacao,
        });

      if (!rpcError && listId) {
        m3uListId = listId;
        console.log('[smartone-sync] Lista M3U selecionada via plano:', listId);
      }
    }

    // Fallback: buscar lista padrão se não encontrar pela função
    if (!m3uListId) {
      console.log('[smartone-sync] Usando lista padrão como fallback...');
      const { data: defaultList, error: defaultError } = await supabaseService
        .from('m3u_lists')
        .select('id')
        .eq('is_default', true)
        .eq('status', 'active')
        .maybeSingle();

      if (!defaultError && defaultList) {
        m3uListId = defaultList.id;
      }
    }

    // Buscar URL da lista selecionada
    if (!m3uListId) {
      console.error('[smartone-sync] Nenhuma lista M3U disponível');
      return new Response(
        JSON.stringify({ error: 'Nenhuma lista M3U disponível' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: m3uList, error: dbError } = await supabaseService
      .from('m3u_lists')
      .select('file_url, plan_type, name')
      .eq('id', m3uListId)
      .single();

    if (dbError || !m3uList) {
      console.error('[smartone-sync] M3U list error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Lista M3U não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[smartone-sync] Lista M3U: ${m3uList.name} (${m3uList.plan_type})`);

    console.log('[smartone-sync] Calling SmartOne API');
    
    const smartoneResponse = await fetch(`${SMARTONE_API_BASE_URL}/playlist/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_api: SMARTONE_CLIENT_API,
        key_api: SMARTONE_KEY_API,
        mac: mac,
        m3u_url: m3uList.file_url,
        name: clienteNome,
      }),
    });

    const responseText = await smartoneResponse.text();
    let smartoneData;
    
    try {
      smartoneData = JSON.parse(responseText);
    } catch {
      smartoneData = { success: false, error: 'Resposta inválida', raw_response: responseText };
    }

    if (smartoneResponse.ok && smartoneData.success) {
      console.log('[smartone-sync] Success');
      return new Response(
        JSON.stringify({ success: true, message: 'Playlist criada com sucesso', data: smartoneData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('[smartone-sync] Failed:', smartoneData);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao sincronizar', details: smartoneData }),
        { status: smartoneResponse.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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
