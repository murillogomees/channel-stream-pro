import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    const token = url.searchParams.get('token');
    const clientId = url.searchParams.get('client');

    if (!streamUrl || !token || !clientId) {
      return new Response('Missing parameters', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Decodificar a URL do stream
    const decodedStreamUrl = decodeURIComponent(streamUrl);

    // Verificar autenticação do cliente
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: cliente, error: clientError } = await supabase
      .from('clientes')
      .select('id, cliente_ativo, data_vencimento')
      .eq('id', clientId)
      .single();

    if (clientError || !cliente) {
      console.error('Cliente não encontrado:', clientError);
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Verificar se o cliente está ativo e não vencido
    const today = new Date();
    const vencimento = cliente.data_vencimento ? new Date(cliente.data_vencimento) : null;
    
    if (!cliente.cliente_ativo || (vencimento && vencimento < today)) {
      return new Response('Subscription expired', { 
        status: 403,
        headers: corsHeaders 
      });
    }

    // Verificar token (simples verificação - pode ser melhorada com JWT)
    const expectedToken = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${clientId}-${Deno.env.get('STREAM_PROXY_SECRET') || 'default-secret'}`)
    );
    const expectedTokenHex = Array.from(new Uint8Array(expectedToken))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (token !== expectedTokenHex.substring(0, 32)) {
      return new Response('Invalid token', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Fazer proxy do stream
    console.log(`Proxying stream for client ${clientId}: ${decodedStreamUrl}`);

    const streamResponse = await fetch(decodedStreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!streamResponse.ok) {
      console.error(`Stream fetch failed: ${streamResponse.status}`);
      return new Response('Stream unavailable', { 
        status: 502,
        headers: corsHeaders 
      });
    }

    // Retransmitir o stream com headers apropriados
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', streamResponse.headers.get('Content-Type') || 'video/mp2t');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Connection', 'keep-alive');
    
    // Manter headers importantes do stream original
    const keepHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
    keepHeaders.forEach(header => {
      const value = streamResponse.headers.get(header);
      if (value) headers.set(header, value);
    });

    return new Response(streamResponse.body, {
      status: streamResponse.status,
      headers,
    });

  } catch (error) {
    console.error('Stream proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
