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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin', { uid: user.id });
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado - privilégios de administrador necessários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { channelId } = await req.json();
    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar canal
    const { data: channel, error: channelError } = await supabaseService
      .from('m3u_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      throw new Error(`Canal não encontrado: ${channelError?.message}`);
    }

    if (!channel.is_vod) {
      throw new Error('Canal não está marcado como VOD');
    }

    // Criar registro de download
    const { data: downloadRecord } = await supabaseService
      .from('vod_downloads')
      .insert({
        channel_id: channelId,
        original_url: channel.stream_url,
        status: 'downloading',
        download_started_at: new Date().toISOString()
      })
      .select()
      .single();

    console.log(`🎬 Iniciando download de VOD: ${channel.name}`);

    try {
      // Detectar se é HLS (.m3u8) ou stream direto
      const isHLS = channel.stream_url.includes('.m3u8');
      
      if (isHLS) {
        await downloadHLSVOD(channel, downloadRecord.id, supabaseService);
      } else {
        await downloadDirectVOD(channel, downloadRecord.id, supabaseService);
      }

      // Atualizar canal com URL do R2
      const r2Url = `https://${Deno.env.get('R2_PUBLIC_DOMAIN')}/vod/${channelId}/playlist.m3u8`;
      
      await supabaseService
        .from('m3u_channels')
        .update({
          r2_uploaded: true,
          r2_url: r2Url,
          r2_uploaded_at: new Date().toISOString()
        })
        .eq('id', channelId);

      await supabaseService
        .from('vod_downloads')
        .update({
          status: 'completed',
          download_completed_at: new Date().toISOString()
        })
        .eq('id', downloadRecord.id);

      console.log(`✅ VOD baixado com sucesso: ${channel.name}`);

      return new Response(
        JSON.stringify({
          success: true,
          channelId,
          r2Url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (downloadError) {
      console.error(`❌ Erro no download de VOD:`, downloadError);
      
      await supabaseService
        .from('vod_downloads')
        .update({
          status: 'failed',
          error_message: downloadError.message,
          retry_count: downloadRecord.retry_count + 1
        })
        .eq('id', downloadRecord.id);

      throw downloadError;
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Download de VOD HLS (.m3u8 + segmentos .ts)
 */
async function downloadHLSVOD(
  channel: any, 
  downloadId: string, 
  supabase: any
) {
  console.log(`📥 Baixando HLS: ${channel.stream_url}`);

  // 1. Download do manifest principal
  const manifestResponse = await fetch(channel.stream_url);
  if (!manifestResponse.ok) {
    throw new Error(`Falha ao baixar manifest: ${manifestResponse.status}`);
  }

  const manifestContent = await manifestResponse.text();
  
  // 2. Parse do manifest para identificar segmentos .ts
  const lines = manifestContent.split('\n');
  const tsUrls: string[] = [];
  const baseUrl = channel.stream_url.substring(0, channel.stream_url.lastIndexOf('/') + 1);

  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const tsUrl = line.startsWith('http') ? line : baseUrl + line;
      tsUrls.push(tsUrl);
    }
  }

  console.log(`📊 Total de segmentos: ${tsUrls.length}`);

  // Atualizar contagem total
  await supabase
    .from('vod_downloads')
    .update({ segment_count: tsUrls.length })
    .eq('id', downloadId);

  // 3. Download paralelo de segmentos (batches de 5)
  const s3Client = createS3Client();
  const batchSize = 5;
  let downloadedCount = 0;
  let totalBytes = 0;

  for (let i = 0; i < tsUrls.length; i += batchSize) {
    const batch = tsUrls.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (tsUrl, index) => {
        const segmentIndex = i + index;
        const segmentResponse = await fetch(tsUrl);
        const segmentData = await segmentResponse.arrayBuffer();
        totalBytes += segmentData.byteLength;

        // Upload para R2
        await s3Client.send(
          new PutObjectCommand({
            Bucket: Deno.env.get('R2_BUCKET_NAME'),
            Key: `vod/${channel.id}/segment_${segmentIndex.toString().padStart(6, '0')}.ts`,
            Body: new Uint8Array(segmentData),
            ContentType: 'video/mp2t',
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );

        downloadedCount++;
        
        // Atualizar progresso a cada 10 segmentos
        if (downloadedCount % 10 === 0) {
          await supabase
            .from('vod_downloads')
            .update({ 
              segments_downloaded: downloadedCount,
              file_size_bytes: totalBytes 
            })
            .eq('id', downloadId);
        }
      })
    );
  }

  // 4. Gerar novo manifest apontando para R2
  const newManifest = manifestContent.replace(
    /^(?!#)(.*\.ts)$/gm,
    (match) => {
      const segmentIndex = tsUrls.indexOf(
        match.startsWith('http') ? match : baseUrl + match
      );
      return `https://${Deno.env.get('R2_PUBLIC_DOMAIN')}/vod/${channel.id}/segment_${segmentIndex.toString().padStart(6, '0')}.ts`;
    }
  );

  // 5. Upload do novo manifest para R2
  await s3Client.send(
    new PutObjectCommand({
      Bucket: Deno.env.get('R2_BUCKET_NAME'),
      Key: `vod/${channel.id}/playlist.m3u8`,
      Body: newManifest,
      ContentType: 'application/vnd.apple.mpegurl',
      CacheControl: 'public, max-age=3600',
    })
  );

  await supabase
    .from('vod_downloads')
    .update({ 
      segments_downloaded: downloadedCount,
      file_size_bytes: totalBytes,
      status: 'processing'
    })
    .eq('id', downloadId);

  console.log(`✅ HLS baixado: ${downloadedCount} segmentos, ${(totalBytes / 1048576).toFixed(2)} MB`);
}

/**
 * Download de stream direto (não-HLS)
 */
async function downloadDirectVOD(
  channel: any, 
  downloadId: string, 
  supabase: any
) {
  console.log(`📥 Baixando stream direto: ${channel.stream_url}`);

  const streamResponse = await fetch(channel.stream_url);
  if (!streamResponse.ok) {
    throw new Error(`Falha ao baixar stream: ${streamResponse.status}`);
  }

  const streamData = await streamResponse.arrayBuffer();
  const fileSize = streamData.byteLength;

  console.log(`📊 Tamanho do arquivo: ${(fileSize / 1048576).toFixed(2)} MB`);

  // Upload para R2
  const s3Client = createS3Client();
  const ext = channel.stream_url.split('.').pop() || 'mp4';

  await s3Client.send(
    new PutObjectCommand({
      Bucket: Deno.env.get('R2_BUCKET_NAME'),
      Key: `vod/${channel.id}/video.${ext}`,
      Body: new Uint8Array(streamData),
      ContentType: `video/${ext}`,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  await supabase
    .from('vod_downloads')
    .update({ 
      file_size_bytes: fileSize,
      segment_count: 1,
      segments_downloaded: 1,
      status: 'processing'
    })
    .eq('id', downloadId);

  console.log(`✅ Stream direto baixado: ${(fileSize / 1048576).toFixed(2)} MB`);
}

/**
 * Criar cliente S3 para Cloudflare R2
 */
function createS3Client() {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error('R2 credentials not configured');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
}
