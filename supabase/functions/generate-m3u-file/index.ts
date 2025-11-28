import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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

    // Gerar conteúdo M3U
    let m3uContent = '#EXTM3U\n\n';
    let totalChannels = 0;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';

    for (const category of categories) {
      const { data: channels } = await supabaseService
        .from('m3u_channels')
        .select('*')
        .eq('category_id', category.id)
        .order('order_position', { ascending: true });

      if (channels && channels.length > 0) {
        for (const channel of channels) {
          let streamUrl;
          
          // ✅ LÓGICA VOD: Se é VOD e já foi uploadado para R2, usar URL do R2 diretamente
          if (channel.is_vod && channel.r2_uploaded && channel.r2_url) {
            streamUrl = channel.r2_url; // URL direta do R2, sem proxy
          } else {
            // Live stream ou VOD ainda não baixado: usar proxy
            const encodedStreamUrl = encodeURIComponent(channel.stream_url);
            streamUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodedStreamUrl}&list=${customListId}`;
          }
          
          const tvgId = channel.tvg_id ? ` tvg-id="${channel.tvg_id}"` : '';
          const tvgName = channel.tvg_name ? ` tvg-name="${channel.tvg_name}"` : '';
          const tvgLogo = channel.tvg_logo ? ` tvg-logo="${channel.tvg_logo}"` : '';
          const groupTitle = ` group-title="${category.display_name}"`;

          m3uContent += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${channel.name}\n`;
          m3uContent += `${streamUrl}\n\n`;
          totalChannels++;
        }
      }
    }

    const generationTime = Date.now() - startTime;
    const fileSize = new TextEncoder().encode(m3uContent).length;

    // Upload para CDN (Cloudflare R2)
    let cdnUrl: string | null = null;
    let uploadTime = 0;
    let cdnUploadStatus = 'skipped';

    try {
      cdnUrl = await uploadToR2(customList.slug, m3uContent);
      uploadTime = Date.now() - startTime - generationTime;
      cdnUploadStatus = 'success';
    } catch (uploadError) {
      console.error('⚠️ R2 upload failed, continuing without CDN:', uploadError.message);
      cdnUploadStatus = 'failed';
    }

    // Atualizar lista com CDN URL (ou null se falhou)
    await supabaseService
      .from('m3u_custom_lists')
      .update({
        cdn_url: cdnUrl,
        bucket_path: cdnUrl ? `${customList.slug}.m3u` : null,
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
        cdn_upload_status: cdnUploadStatus,
        cdn_upload_time_ms: uploadTime
      });

    console.log(`✅ M3U gerada: ${customList.name} (${totalChannels} canais, ${fileSize} bytes, CDN: ${cdnUploadStatus})`);

    return new Response(
      JSON.stringify({
        success: true,
        cdnUrl,
        fileSize,
        channelsCount: totalChannels,
        generationTime,
        uploadTime,
        cdnStatus: cdnUploadStatus
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
 * Upload para Cloudflare R2 usando API S3 nativa com assinatura AWS v4
 */
async function uploadToR2(slug: string, content: string): Promise<string> {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME');
  const R2_PUBLIC_DOMAIN = Deno.env.get('R2_PUBLIC_DOMAIN');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    throw new Error('R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME secrets.');
  }

  const fileName = `playlists/${slug}.m3u`;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${fileName}`;
  const body = new TextEncoder().encode(content);

  // AWS Signature V4
  const region = 'auto';
  const service = 's3';
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const contentType = 'audio/x-mpegurl';

  // Create canonical request
  const method = 'PUT';
  const canonicalUri = `/${R2_BUCKET}/${fileName}`;
  const canonicalQueryString = '';
  
  // Hash the payload
  const payloadHash = await sha256Hex(body);
  
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  // Calculate signature
  const signingKey = await getSignatureKey(R2_SECRET_KEY, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  // Create authorization header
  const authorization = `${algorithm} Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Make request
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
      'Cache-Control': 'public, max-age=3600',
    },
    body: body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }

  const publicDomain = R2_PUBLIC_DOMAIN || `${R2_BUCKET}.r2.dev`;
  return `https://${publicDomain}/${fileName}`;
}

// AWS Signature V4 helper functions
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const result = await hmacSha256(key, data);
  return Array.from(new Uint8Array(result))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}
