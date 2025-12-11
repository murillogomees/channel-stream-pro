const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use environment variable first, fallback to request body
    const envToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
    
    let accessToken = envToken;
    let checkSecretsOnly = false;
    
    // Allow override from request body for testing specific tokens
    try {
      const body = await req.json();
      if (body.checkSecrets) {
        checkSecretsOnly = true;
      }
      if (body.accessToken && body.accessToken !== 'test' && body.accessToken !== 'will-use-env') {
        accessToken = body.accessToken;
      }
    } catch {
      // No body or invalid JSON - use env token
    }
    
    // Just check if secrets are configured
    if (checkSecretsOnly) {
      return new Response(
        JSON.stringify({ 
          secretsConfigured: !!envToken,
          webhookSecretConfigured: !!webhookSecret,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          error: 'Access token não configurado. Configure MERCADO_PAGO_ACCESS_TOKEN nas secrets.',
          secretsConfigured: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[MercadoPago Test] Testing token (last 4 chars):', accessToken.slice(-4));

    // Call Mercado Pago API from server-side to avoid CORS
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[MercadoPago Test] Success - User ID:', data.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          email: data.email, 
          id: data.id,
          nickname: data.nickname,
          using_env: accessToken === envToken,
          secretsConfigured: true,
          webhookSecretConfigured: !!webhookSecret,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('[MercadoPago Test] Auth failed:', errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Falha na autenticação',
          details: errorData,
          token_hint: accessToken.slice(-4),
          secretsConfigured: true,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[MercadoPago Test] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao conectar com Mercado Pago' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Export for dynamic import by main router
export default handler;

// Also support direct Deno.serve for standalone mode
if (import.meta.main) {
  Deno.serve(handler);
}
