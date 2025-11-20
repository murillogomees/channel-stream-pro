import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.418.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ SECURITY: Require admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin', { uid: user.id });
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilégios de administrador necessários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { customListId } = await req.json();

    if (!customListId) {
      return new Response(
        JSON.stringify({ error: 'customListId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startTime = Date.now();

    // Buscar lista personalizada
    const { data: customList, error: listError } = await supabaseService
      .from('m3u_custom_lists')
      .select('*')
      .eq('id', customListId)
      .single();

    if (listError || !customList) {
      throw new Error(`Lista não encontrada: ${listError?.message}`);
    }

    // Buscar categorias
    const { data: categories } = await supabaseService
      .from('m3u_categories')
      .select('*')
      .eq('custom_list_id', customListId)
      .order('order_position', { ascending: true });

    if (!categories || categories.length === 0) {
      throw new Error('Lista sem categorias configuradas');
    }

    // Função para gerar token de autenticação
    const generateStreamToken = async (clientId: string): Promise<string> => {
      const secret = Deno.env.get('STREAM_PROXY_SECRET') || 'default-secret';
      const data = `${clientId}-${secret}`;
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(data)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 32);
    };

    // Gerar conteúdo M3U
    let m3uContent = '#EXTM3U\n\n';
    let totalChannels = 0;

    for (const category of categories) {
      const { data: channels } = await supabaseService
        .from('m3u_channels')
        .select('*')
        .eq('category_id', category.id)
        .order('order_position', { ascending: true });

      if (channels && channels.length > 0) {
        for (const channel of channels) {
          // Buscar clientes atribuídos a esta lista
          const { data: assignments } = await supabaseService
            .from('client_m3u_custom_assignments')
            .select('cliente_id')
            .eq('custom_list_id', customListId);

          // Usar primeiro cliente ou 'default'
          const clientId = assignments && assignments.length > 0 
            ? assignments[0].cliente_id 
            : 'default';
          
          const token = await generateStreamToken(clientId);
          
          // Codificar URL original
          const encodedStreamUrl = encodeURIComponent(channel.stream_url);
          
          // Gerar URL do proxy
          const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
          const proxyUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodedStreamUrl}&token=${token}&client=${clientId}`;
          
          const tvgId = channel.tvg_id ? ` tvg-id="${channel.tvg_id}"` : '';
          const tvgName = channel.tvg_name ? ` tvg-name="${channel.tvg_name}"` : '';
          const tvgLogo = channel.tvg_logo ? ` tvg-logo="${channel.tvg_logo}"` : '';
          const groupTitle = ` group-title="${category.display_name}"`;

          m3uContent += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${channel.name}\n`;
          m3uContent += `${proxyUrl}\n\n`;
          totalChannels++;
        }
      }
    }

    const generationTime = Date.now() - startTime;
    const fileSize = new TextEncoder().encode(m3uContent).length;

    // Upload para CDN (Cloudflare R2 ou Amazon S3)
    const cdnUrl = await uploadToCDN(customList.slug, m3uContent);

    const uploadTime = Date.now() - startTime - generationTime;

    // Atualizar lista com CDN URL
    await supabaseService
      .from('m3u_custom_lists')
      .update({
        cdn_url: cdnUrl,
        bucket_path: `${customList.slug}.m3u`,
        total_channels: totalChannels,
        total_categories: categories.length,
        last_generated_at: new Date().toISOString()
      })
      .eq('id', customListId);

    // Registrar log
    await supabaseService
      .from('m3u_generation_logs')
      .insert({
        custom_list_id: customListId,
        file_size: fileSize,
        channels_count: totalChannels,
        generation_time_ms: generationTime,
        cdn_upload_status: 'success',
        cdn_upload_time_ms: uploadTime
      });

    console.log(`✅ M3U gerada: ${customList.name} (${totalChannels} canais, ${fileSize} bytes)`);

    return new Response(
      JSON.stringify({
        success: true,
        cdnUrl,
        fileSize,
        channelsCount: totalChannels,
        generationTime,
        uploadTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao gerar M3U:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Upload para Cloudflare R2
 */
async function uploadToCDN(slug: string, content: string): Promise<string> {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME');
  const R2_PUBLIC_DOMAIN = Deno.env.get('R2_PUBLIC_DOMAIN');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    throw new Error('R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME secrets.');
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });

  const fileName = `playlists/${slug}.m3u`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: content,
      ContentType: 'audio/x-mpegurl',
      CacheControl: 'public, max-age=3600',
    })
  );

  const publicDomain = R2_PUBLIC_DOMAIN || `${R2_BUCKET}.r2.dev`;
  return `https://${publicDomain}/${fileName}`;
}
