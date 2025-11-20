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
    const listId = url.searchParams.get('list');

    if (!streamUrl || !listId) {
      return new Response('Missing parameters', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Verificar autenticação via Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized - No auth token', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Criar cliente autenticado
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized - Invalid token', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Buscar cliente associado ao usuário
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: cliente, error: clientError } = await supabaseService
      .from('clientes')
      .select('id, cliente_ativo, data_vencimento')
      .eq('user_id', user.id)
      .single();

    if (clientError || !cliente) {
      console.error('Cliente não encontrado:', clientError);
      return new Response('Unauthorized - No client found', { 
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

    // Verificar se o cliente tem acesso a esta lista
    const { data: assignment } = await supabaseService
      .from('client_m3u_custom_assignments')
      .select('id')
      .eq('cliente_id', cliente.id)
      .eq('custom_list_id', listId)
      .single();

    if (!assignment) {
      return new Response('Forbidden - No access to this playlist', { 
        status: 403,
        headers: corsHeaders 
      });
    }

    // Decodificar a URL do stream
    const decodedStreamUrl = decodeURIComponent(streamUrl);

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

    // Retransmitir o stream com headers apropriados + CDN optimization
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', streamResponse.headers.get('Content-Type') || 'video/mp2t');
    headers.set('Connection', 'keep-alive');
    
    // Cache headers otimizados para CDN (Cloudflare)
    if (decodedStreamUrl.includes('.m3u8')) {
      // HLS manifests: cache curto (atualiza frequentemente)
      headers.set('Cache-Control', 'public, max-age=10, s-maxage=30');
      headers.set('CDN-Cache-Control', 'public, max-age=30');
    } else if (decodedStreamUrl.includes('.ts')) {
      // Segmentos de vídeo: cache longo (imutáveis)
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, immutable');
      headers.set('CDN-Cache-Control', 'public, max-age=86400');
    } else {
      // Outros conteúdos: cache moderado
      headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
      headers.set('CDN-Cache-Control', 'public, max-age=300');
    }
    
    // Headers para Cloudflare
    headers.set('Cloudflare-CDN-Cache-Control', 'max-age=31536000');
    
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
