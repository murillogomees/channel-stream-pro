import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// Declaração do EdgeRuntime para Deno
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

let r2Client: AwsClient | null = null;

function getR2Client(): AwsClient {
  if (r2Client) return r2Client;
  
  const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  
  if (!R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error('R2 credentials not configured');
  }
  
  r2Client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
    service: 's3',
  });
  
  return r2Client;
}

function getR2Endpoint(): string {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
  
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME) {
    throw new Error('R2 account/bucket not configured');
  }
  
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;
}

async function uploadToR2(key: string, body: Uint8Array, contentType: string, cacheControl: string): Promise<void> {
  const client = getR2Client();
  const endpoint = getR2Endpoint();
  
  const response = await client.fetch(`${endpoint}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    },
    body,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = req.headers.get('x-supabase-cron-secret');
    const internalSecret = req.headers.get('x-internal-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Permitir: cron secret, internal secret (service-to-service), ou admin auth
    const isCronRequest = cronSecret === expectedCronSecret;
    const isInternalRequest = internalSecret === expectedCronSecret;
    const isServiceRoleRequest = authHeader?.includes(serviceRoleKey || '');

    if (!isCronRequest && !isInternalRequest && !isServiceRoleRequest) {
      if (authHeader) {
        const supabaseAuth = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Token inválido' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: isAdmin } = await supabaseAuth.rpc('is_admin', { uid: user.id });
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Acesso negado' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Autenticação necessária' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { channelId, batch = false, channelIds = [] } = body;

    // Modo batch: processar múltiplos canais em background
    if (batch && channelIds.length > 0) {
      console.log(`🚀 [VOD] Iniciando batch de ${channelIds.length} downloads em background`);
      
      EdgeRuntime.waitUntil(processBatchDownloads(channelIds, supabaseService));
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `${channelIds.length} downloads iniciados em background`,
          channelIds
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Modo single
    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar canal
    const { data: channel, error: channelError } = await supabaseService
      .from('m3u_channels')
      .select('*')
      .eq('id', channelId)
      .maybeSingle();

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
        status: 'queued',
        download_started_at: new Date().toISOString()
      })
      .select()
      .single();

    console.log(`🎬 [VOD] Download enfileirado: ${channel.name}`);

    // Processar em background para resposta rápida
    EdgeRuntime.waitUntil(
      processVODDownload(channel, downloadRecord?.id || '', supabaseService)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Download iniciado em background',
        channelId,
        downloadId: downloadRecord?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [VOD] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Processa batch de downloads em paralelo controlado
 */
async function processBatchDownloads(
  channelIds: string[],
  supabase: any
): Promise<void> {
  const CONCURRENCY = 3; // Downloads simultâneos
  const queue = [...channelIds];
  const active: Promise<void>[] = [];

  console.log(`📦 [VOD Batch] Processando ${queue.length} VODs com concorrência de ${CONCURRENCY}`);

  while (queue.length > 0 || active.length > 0) {
    // Preencher slots disponíveis
    while (active.length < CONCURRENCY && queue.length > 0) {
      const channelId = queue.shift()!;
      
      const promise = (async () => {
        try {
          const { data: channel } = await supabase
            .from('m3u_channels')
            .select('*')
            .eq('id', channelId)
            .maybeSingle();

          if (channel && channel.is_vod && !channel.r2_uploaded) {
            const { data: downloadRecord } = await supabase
              .from('vod_downloads')
              .insert({
                channel_id: channelId,
                original_url: channel.stream_url,
                status: 'downloading',
                download_started_at: new Date().toISOString()
              })
              .select()
              .single();

            await processVODDownload(channel, downloadRecord?.id || '', supabase);
          }
        } catch (err) {
          console.error(`❌ [VOD Batch] Erro em ${channelId}:`, err);
        }
      })();

      active.push(promise);
    }

    if (active.length > 0) {
      // Aguardar pelo menos um terminar
      await Promise.race(active);
      // Remover completados
      for (let i = active.length - 1; i >= 0; i--) {
        const result = await Promise.race([active[i], Promise.resolve('pending')]);
        if (result !== 'pending') {
          active.splice(i, 1);
        }
      }
    }
  }

  console.log(`✅ [VOD Batch] Batch concluído`);
}

/**
 * Processa download de um VOD individual
 */
async function processVODDownload(
  channel: any,
  downloadId: string,
  supabase: any
): Promise<void> {
  const startTime = Date.now();

  try {
    await supabase
      .from('vod_downloads')
      .update({ status: 'downloading' })
      .eq('id', downloadId);

    console.log(`📥 [VOD] Iniciando: ${channel.name}`);

    const isHLS = channel.stream_url.includes('.m3u8');

    if (isHLS) {
      await downloadHLSVODStreaming(channel, downloadId, supabase);
    } else {
      await downloadDirectVODStreaming(channel, downloadId, supabase);
    }

    // Atualizar canal com URL do R2
    const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN');
    const r2Url = isHLS 
      ? `https://${r2Domain}/vod/${channel.id}/playlist.m3u8`
      : `https://${r2Domain}/vod/${channel.id}/video.mp4`;

    await supabase
      .from('m3u_channels')
      .update({
        r2_uploaded: true,
        r2_url: r2Url,
        r2_uploaded_at: new Date().toISOString()
      })
      .eq('id', channel.id);

    await supabase
      .from('vod_downloads')
      .update({
        status: 'completed',
        r2_url: r2Url,
        download_completed_at: new Date().toISOString()
      })
      .eq('id', downloadId);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [VOD] Concluído: ${channel.name} em ${duration}s`);

  } catch (error: any) {
    console.error(`❌ [VOD] Falha: ${channel.name} - ${error.message}`);

    await supabase
      .from('vod_downloads')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('id', downloadId);
    
    // Incrementar retry count separadamente
    await supabase.rpc('increment_vod_retry', { download_id: downloadId }).catch(() => {});
  }
}

/**
 * Download HLS com streaming para R2 (não carrega tudo na memória)
 */
async function downloadHLSVODStreaming(
  channel: any,
  downloadId: string,
  supabase: any
): Promise<void> {
  const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN')!;

  // 1. Download do manifest
  const manifestResponse = await fetchWithTimeout(channel.stream_url, 30000);
  if (!manifestResponse.ok) {
    throw new Error(`Falha ao baixar manifest: ${manifestResponse.status}`);
  }

  const manifestContent = await manifestResponse.text();
  const baseUrl = channel.stream_url.substring(0, channel.stream_url.lastIndexOf('/') + 1);

  // 2. Parse segmentos
  const lines = manifestContent.split('\n');
  const segments: { index: number; url: string; line: string }[] = [];
  let segmentIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const url = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
      segments.push({ index: segmentIndex++, url, line: trimmed });
    }
  }

  console.log(`📊 [VOD HLS] ${segments.length} segmentos para ${channel.name}`);

  // Atualizar segment_count imediatamente para mostrar progresso
  await supabase
    .from('vod_downloads')
    .update({ 
      segment_count: segments.length,
      segments_downloaded: 0,
      status: 'downloading'
    })
    .eq('id', downloadId);

  // 3. Download paralelo com throttling (5 simultâneos)
  let totalBytes = 0;
  let downloadedCount = 0;
  const PARALLEL_DOWNLOADS = 5;
  let lastProgressUpdate = Date.now();

  for (let i = 0; i < segments.length; i += PARALLEL_DOWNLOADS) {
    const batch = segments.slice(i, i + PARALLEL_DOWNLOADS);

    await Promise.all(
      batch.map(async (segment) => {
        try {
          const response = await fetchWithTimeout(segment.url, 60000);
          if (!response.ok) {
            throw new Error(`Segment ${segment.index} failed: ${response.status}`);
          }

          const data = await response.arrayBuffer();
          totalBytes += data.byteLength;

          // Upload para R2
          await uploadToR2(
            `vod/${channel.id}/segment_${segment.index.toString().padStart(6, '0')}.ts`,
            new Uint8Array(data),
            'video/mp2t',
            'public, max-age=31536000, immutable'
          );

          downloadedCount++;
        } catch (err) {
          console.error(`⚠️ [VOD] Segment ${segment.index} error:`, err);
          // Retry uma vez
          try {
            const retryResponse = await fetchWithTimeout(segment.url, 60000);
            if (retryResponse.ok) {
              const data = await retryResponse.arrayBuffer();
              totalBytes += data.byteLength;
              await uploadToR2(
                `vod/${channel.id}/segment_${segment.index.toString().padStart(6, '0')}.ts`,
                new Uint8Array(data),
                'video/mp2t',
                'public, max-age=31536000, immutable'
              );
              downloadedCount++;
            }
          } catch {
            console.error(`❌ [VOD] Segment ${segment.index} retry failed`);
          }
        }
      })
    );

    // Atualizar progresso a cada 2 segundos ou a cada 5 segmentos para tempo real
    const now = Date.now();
    if (now - lastProgressUpdate > 2000 || downloadedCount % 5 === 0 || i + PARALLEL_DOWNLOADS >= segments.length) {
      lastProgressUpdate = now;
      await supabase
        .from('vod_downloads')
        .update({
          segments_downloaded: downloadedCount,
          file_size_bytes: totalBytes
        })
        .eq('id', downloadId);
      
      console.log(`📈 [VOD] Progresso: ${downloadedCount}/${segments.length} (${Math.round((downloadedCount/segments.length)*100)}%)`);
    }
  }

  // 4. Gerar novo manifest apontando para R2
  let newManifest = manifestContent;
  for (const segment of segments) {
    const r2SegmentUrl = `https://${r2Domain}/vod/${channel.id}/segment_${segment.index.toString().padStart(6, '0')}.ts`;
    newManifest = newManifest.replace(segment.line, r2SegmentUrl);
  }

  // 5. Upload manifest
  await uploadToR2(
    `vod/${channel.id}/playlist.m3u8`,
    new TextEncoder().encode(newManifest),
    'application/vnd.apple.mpegurl',
    'public, max-age=3600'
  );

  console.log(`✅ [VOD HLS] Concluído: ${downloadedCount}/${segments.length} segmentos, ${(totalBytes / 1048576).toFixed(1)} MB`);
}

/**
 * Download de stream direto com streaming e progresso real
 */
async function downloadDirectVODStreaming(
  channel: any,
  downloadId: string,
  supabase: any
): Promise<void> {
  console.log(`📥 [VOD Direct] Baixando: ${channel.name}`);

  const response = await fetchWithTimeout(channel.stream_url, 300000); // 5 min timeout
  if (!response.ok) {
    throw new Error(`Falha ao baixar: ${response.status}`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0');
  
  // Para arquivos grandes, usar 100 chunks virtuais para mostrar progresso
  const VIRTUAL_CHUNKS = contentLength > 100 * 1024 * 1024 ? 100 : 10;
  const chunkSize = contentLength > 0 ? Math.ceil(contentLength / VIRTUAL_CHUNKS) : 10 * 1024 * 1024;
  
  await supabase
    .from('vod_downloads')
    .update({
      segment_count: VIRTUAL_CHUNKS,
      segments_downloaded: 0,
      file_size_bytes: contentLength,
      status: 'downloading'
    })
    .eq('id', downloadId);

  // Streaming download com progresso
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Stream não disponível');
  }

  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;
  let lastProgressUpdate = Date.now();
  let reportedChunks = 0;

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    if (value) {
      chunks.push(value);
      downloadedBytes += value.length;
      
      // Calcular chunks completos
      const currentChunks = Math.min(
        VIRTUAL_CHUNKS,
        Math.floor((downloadedBytes / contentLength) * VIRTUAL_CHUNKS)
      );
      
      // Atualizar progresso a cada 2s ou quando houver mudança significativa
      const now = Date.now();
      if (currentChunks > reportedChunks || now - lastProgressUpdate > 2000) {
        reportedChunks = currentChunks;
        lastProgressUpdate = now;
        
        await supabase
          .from('vod_downloads')
          .update({
            segments_downloaded: reportedChunks,
            file_size_bytes: downloadedBytes
          })
          .eq('id', downloadId);
        
        const percent = contentLength > 0 ? Math.round((downloadedBytes / contentLength) * 100) : 0;
        console.log(`📈 [VOD Direct] ${channel.name}: ${percent}% (${(downloadedBytes / 1048576).toFixed(1)} MB)`);
      }
    }
  }

  // Juntar todos os chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const data = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  // Determinar extensão
  const urlPath = new URL(channel.stream_url).pathname;
  const ext = urlPath.split('.').pop() || 'mp4';

  // Marcar como processando durante upload
  await supabase
    .from('vod_downloads')
    .update({
      status: 'processing',
      file_size_bytes: totalLength,
      segments_downloaded: VIRTUAL_CHUNKS
    })
    .eq('id', downloadId);

  console.log(`⬆️ [VOD Direct] Uploading ${(totalLength / 1048576).toFixed(1)} MB to R2...`);

  await uploadToR2(
    `vod/${channel.id}/video.${ext}`,
    data,
    ext === 'mp4' ? 'video/mp4' : `video/${ext}`,
    'public, max-age=31536000, immutable'
  );

  // Marcar como concluído
  await supabase
    .from('vod_downloads')
    .update({
      file_size_bytes: totalLength,
      segment_count: VIRTUAL_CHUNKS,
      segments_downloaded: VIRTUAL_CHUNKS
    })
    .eq('id', downloadId);

  console.log(`✅ [VOD Direct] Concluído: ${(totalLength / 1048576).toFixed(1)} MB`);
}

/**
 * Fetch com timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VOD-Downloader/1.0',
        'Accept': '*/*',
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
