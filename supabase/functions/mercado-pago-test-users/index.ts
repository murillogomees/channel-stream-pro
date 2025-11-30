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
    const { accessToken, action } = await req.json();
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if using sandbox token - test user creation requires PRODUCTION token
    const isSandboxToken = accessToken.startsWith('TEST-');

    if (action === 'create') {
      if (isSandboxToken) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Para criar usuários de teste, você precisa usar o Access Token de PRODUÇÃO (APP_USR-...), não o de sandbox (TEST-...).',
            info: {
              reason: 'A API do Mercado Pago exige credenciais de produção para criar usuários de teste.',
              solution: 'Use o token de produção para criar usuários de teste, depois use-os no ambiente sandbox.',
              documentation: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts'
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create test user with production token
      console.log('[MercadoPago Test Users] Creating test user with production token');
      
      const response = await fetch('https://api.mercadopago.com/users/test_user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_id: 'MLB' // Brazil
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('[MercadoPago Test Users] Test user created successfully:', data.id);
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: {
              id: data.id,
              nickname: data.nickname,
              email: data.email,
              password: data.password,
              site_status: data.site_status
            },
            message: 'Usuário de teste criado com sucesso! Guarde as credenciais.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('[MercadoPago Test Users] Error creating test user:', data);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Falha ao criar usuário de teste',
            details: data 
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Default: Return helpful information
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'API de Usuários de Teste do Mercado Pago',
        info: {
          importante: 'A criação de usuários de teste requer o Access Token de PRODUÇÃO, não o de sandbox.',
          comoUsar: 'Envie action="create" com o token de produção para criar um novo usuário de teste.',
          tokenAtual: isSandboxToken ? 'Sandbox (TEST-...)' : 'Produção (APP_USR-...)',
          documentation: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MercadoPago Test Users] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
