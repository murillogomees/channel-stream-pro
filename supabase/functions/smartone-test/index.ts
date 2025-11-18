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
    const smartoneApiUrl = Deno.env.get('SMARTONE_API_BASE_URL');
    const smartoneKeyApi = Deno.env.get('SMARTONE_KEY_API');
    
    if (!smartoneApiUrl || !smartoneKeyApi) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Configuração do SmartOne incompleta',
          auth_valid: true,
          is_admin: true,
          smartone_configured: false,
          missing_config: {
            api_url: !smartoneApiUrl,
            api_key: !smartoneKeyApi
          },
          latency_ms: Date.now() - startTime
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test SmartOne API connectivity (simple HEAD request)
    const smartoneTestStart = Date.now();
    let smartoneStatus = 'unknown';
    let smartoneLatency = 0;
    let smartoneError = null;

    try {
      const testResponse = await fetch(smartoneApiUrl, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${smartoneKeyApi}`
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
    console.error('[smartone-test] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro interno do servidor',
        details: error.message,
        latency_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
