import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
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

    // Service client for queries
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Run role check and client check in parallel for speed
    const [rolesResult, clienteResult] = await Promise.all([
      supabaseService
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id),
      supabaseService
        .from('clientes')
        .select('id, cliente_ativo, data_vencimento')
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    const roles = rolesResult.data?.map(r => r.role) || [];
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');

    // Se não for admin, verificar cliente e assinatura
    if (!isAdmin) {
      const cliente = clienteResult.data;
      
      if (!cliente) {
        console.error('Cliente não encontrado');
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
        .maybeSingle();

      if (!assignment) {
        return new Response('Forbidden - No access to this playlist', { 
          status: 403,
          headers: corsHeaders 
        });
      }
    }

    // Decodificar a URL do stream
    const decodedStreamUrl = decodeURIComponent(streamUrl);
    console.log(`[StreamProxy] User ${user.id} accessing stream`);

    // Preparar headers para o upstream
    const upstreamHeaders = new Headers();
    
    // Forward Range header for seeking support
    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) {
      upstreamHeaders.set('Range', rangeHeader);
    }
    
    // Set a proper User-Agent
    upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    upstreamHeaders.set('Accept', '*/*');
    upstreamHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    upstreamHeaders.set('Connection', 'keep-alive');

    // Fazer proxy do stream com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    try {
      const streamResponse = await fetch(decodedStreamUrl, {
        headers: upstreamHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!streamResponse.ok) {
        console.error(`[StreamProxy] Stream fetch failed: ${streamResponse.status}`);
        return new Response('Stream unavailable', { 
          status: 502,
          headers: corsHeaders 
        });
      }

      // Build response headers
      const headers = new Headers(corsHeaders);
      
      // Get content type from response or infer from URL
      let contentType = streamResponse.headers.get('Content-Type');
      if (!contentType || contentType === 'application/octet-stream') {
        if (decodedStreamUrl.includes('.m3u8')) {
          contentType = 'application/vnd.apple.mpegurl';
        } else if (decodedStreamUrl.includes('.ts')) {
          contentType = 'video/mp2t';
        } else if (decodedStreamUrl.includes('.mp4')) {
          contentType = 'video/mp4';
        } else {
          contentType = 'video/mp2t';
        }
      }
      headers.set('Content-Type', contentType);
      
      // Cache headers for CDN optimization
      if (decodedStreamUrl.includes('.m3u8')) {
        // HLS manifests: very short cache (live content updates frequently)
        headers.set('Cache-Control', 'public, max-age=2, s-maxage=5');
      } else if (decodedStreamUrl.includes('.ts')) {
        // Video segments: longer cache (immutable content)
        headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, immutable');
      } else {
        headers.set('Cache-Control', 'public, max-age=30, s-maxage=120');
      }
      
      // Keep important headers from upstream
      const keepHeaders = ['Content-Length', 'Accept-Ranges', 'Content-Range'];
      keepHeaders.forEach(header => {
        const value = streamResponse.headers.get(header);
        if (value) headers.set(header, value);
      });

      // Enable range requests if not already set
      if (!headers.has('Accept-Ranges')) {
        headers.set('Accept-Ranges', 'bytes');
      }

      return new Response(streamResponse.body, {
        status: streamResponse.status,
        headers,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[StreamProxy] Request timeout');
        return new Response('Stream timeout', { 
          status: 504,
          headers: corsHeaders 
        });
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('[StreamProxy] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
