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

    // Mercado Pago only provides endpoint to CREATE test users, not LIST them
    // POST /users/test_user creates a new test user
    if (action === 'create') {
      const response = await fetch('https://api.mercadopago.com/users/test_user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_id: 'MLB' // Brazil - change based on country
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: data,
            message: 'Usuário de teste criado com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
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

    // Default: Return info about how test users work
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'A API do Mercado Pago não fornece endpoint para listar usuários de teste. Use action="create" para criar um novo usuário de teste.',
        info: {
          createEndpoint: 'POST /users/test_user',
          documentation: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MercadoPago Test Users] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao conectar com Mercado Pago' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
