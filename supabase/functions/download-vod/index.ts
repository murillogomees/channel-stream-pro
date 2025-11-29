import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

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

async function initiateMultipartUpload(key: string, contentType: string): Promise<string> {
  const client = getR2Client();
  const endpoint = getR2Endpoint();
  
  const response = await client.fetch(`${endpoint}/${key}?uploads`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initiate multipart upload: ${response.status} - ${errorText}`);
  }
  
  const xml = await response.text();
  const uploadIdMatch = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!uploadIdMatch) throw new Error('Failed to get upload ID');
  
  return uploadIdMatch[1];
}

async function uploadPart(key: string, uploadId: string, partNumber: number, body: Uint8Array): Promise<string> {
  const client = getR2Client();
  const endpoint = getR2Endpoint();
  
  const response = await client.fetch(
    `${endpoint}/${key}?partNumber=${partNumber}&uploadId=${uploadId}`,
    { method: 'PUT', body }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload part ${partNumber}: ${response.status} - ${errorText}`);
  }
  
  const etag = response.headers.get('etag');
  if (!etag) throw new Error(`No ETag for part ${partNumber}`);
  
  return etag;
}

async function completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void> {
  const client = getR2Client();
  const endpoint = getR2Endpoint();
  
  const partsXml = parts.map(p => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join('');
  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
  
  const response = await client.fetch(`${endpoint}/${key}?uploadId=${uploadId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to complete multipart: ${response.status} - ${errorText}`);
  }
}

async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  try {
    const client = getR2Client();
    const endpoint = getR2Endpoint();
    await client.fetch(`${endpoint}/${key}?uploadId=${uploadId}`, { method: 'DELETE' });
  } catch (e) {
    console.error('Failed to abort multipart:', e);
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
          return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: isAdmin } = await supabaseAuth.rpc('is_admin', { uid: user.id });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Autenticação necessária' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { channelId, batch = false, channelIds = [] } = body;

    if (batch && channelIds.length > 0) {
      console.log(`🚀 [VOD] Batch de ${channelIds.length} downloads`);
      EdgeRuntime.waitUntil(processBatchDownloads(channelIds, supabaseService));
      return new Response(JSON.stringify({ success: true, message: `${channelIds.length} downloads iniciados`, channelIds }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!channelId) {
      return new Response(JSON.stringify({ error: 'channelId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: channel, error: channelError } = await supabaseService.from('m3u_channels').select('*').eq('id', channelId).maybeSingle();
    if (channelError || !channel) throw new Error(`Canal não encontrado: ${channelError?.message}`);
    if (!channel.is_vod) throw new Error('Canal não é VOD');

    const { data: downloadRecord } = await supabaseService.from('vod_downloads').insert({
      channel_id: channelId,
      original_url: channel.stream_url,
      status: 'queued',
      download_started_at: new Date().toISOString()
    }).select().single();

    console.log(`🎬 [VOD] Download enfileirado: ${channel.name}`);
    EdgeRuntime.waitUntil(processVODDownload(channel, downloadRecord?.id || '', supabaseService));

    return new Response(JSON.stringify({ success: true, message: 'Download iniciado', channelId, downloadId: downloadRecord?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('❌ [VOD] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processBatchDownloads(channelIds: string[], supabase: any): Promise<void> {
  const CONCURRENCY = 2;
  const queue = [...channelIds];
  const active: Promise<void>[] = [];

  while (queue.length > 0 || active.length > 0) {
    while (active.length < CONCURRENCY && queue.length > 0) {
      const channelId = queue.shift()!;
      const promise = (async () => {
        try {
          const { data: channel } = await supabase.from('m3u_channels').select('*').eq('id', channelId).maybeSingle();
          if (channel?.is_vod && !channel.r2_uploaded) {
            const { data: downloadRecord } = await supabase.from('vod_downloads').insert({
              channel_id: channelId,
              original_url: channel.stream_url,
              status: 'downloading',
              download_started_at: new Date().toISOString()
            }).select().single();
            await processVODDownload(channel, downloadRecord?.id || '', supabase);
          }
        } catch (err) {
          console.error(`❌ [Batch] Erro ${channelId}:`, err);
        }
      })();
      active.push(promise);
    }

    if (active.length > 0) {
      await Promise.race(active);
      for (let i = active.length - 1; i >= 0; i--) {
        const result = await Promise.race([active[i], Promise.resolve('pending')]);
        if (result !== 'pending') active.splice(i, 1);
      }
    }
  }
  console.log(`✅ [Batch] Concluído`);
}

async function processVODDownload(channel: any, downloadId: string, supabase: any): Promise<void> {
  const startTime = Date.now();
  let finalStatus = 'failed';
  let finalError = '';

  try {
    if (!downloadId) {
      console.error(`❌ [VOD] Download ID inválido para canal: ${channel.name}`);
      return;
    }
    
    await supabase.from('vod_downloads').update({ status: 'downloading' }).eq('id', downloadId);
    console.log(`📥 [VOD] Iniciando: ${channel.name} (ID: ${downloadId})`);

    const isHLS = channel.stream_url.includes('.m3u8');
    
    try {
      if (isHLS) {
        await downloadHLSVOD(channel, downloadId, supabase);
      } else {
        await downloadDirectVOD(channel, downloadId, supabase);
      }
      console.log(`✅ [VOD] Download concluído, iniciando finalização...`);
    } catch (downloadError: any) {
      console.error(`❌ [VOD] Erro durante download: ${downloadError.message}`);
      throw downloadError;
    }

    const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN');
    if (!r2Domain) {
      throw new Error('R2_PUBLIC_DOMAIN não configurado');
    }
    
    const urlPath = new URL(channel.stream_url).pathname;
    const ext = urlPath.split('.').pop() || 'mp4';
    const r2Url = isHLS 
      ? `https://${r2Domain}/vod/${channel.id}/playlist.m3u8` 
      : `https://${r2Domain}/vod/${channel.id}/video.${ext}`;

    console.log(`⬆️ [VOD] Finalizando download - URL: ${r2Url}`);
    
    // Atualizar canal - CRÍTICO: fazer em transação separada para garantir
    console.log(`⬆️ [VOD] Atualizando canal m3u_channels...`);
    const { error: channelError } = await supabase
      .from('m3u_channels')
      .update({ 
        r2_uploaded: true, 
        r2_url: r2Url, 
        r2_uploaded_at: new Date().toISOString() 
      })
      .eq('id', channel.id);
    
    if (channelError) {
      console.error(`⚠️ [VOD] Erro ao atualizar canal: ${channelError.message}`);
      // Não falhar completamente se só o canal falhar
    } else {
      console.log(`✅ [VOD] Canal atualizado com sucesso`);
    }
    
    // Marcar download como completo - CRÍTICO
    console.log(`⬆️ [VOD] Marcando download como completed...`);
    const { error: downloadError, data: updatedDownload } = await supabase
      .from('vod_downloads')
      .update({ 
        status: 'completed', 
        r2_url: r2Url, 
        download_completed_at: new Date().toISOString(),
        error_message: null // Limpar qualquer erro anterior
      })
      .eq('id', downloadId)
      .select()
      .single();
    
    if (downloadError) {
      console.error(`❌ [VOD] CRÍTICO - Erro ao finalizar download: ${downloadError.message}`);
      // Tentar novamente uma vez
      const { error: retryError } = await supabase
        .from('vod_downloads')
        .update({ status: 'completed', r2_url: r2Url, download_completed_at: new Date().toISOString() })
        .eq('id', downloadId);
      
      if (retryError) {
        console.error(`❌ [VOD] Retry também falhou: ${retryError.message}`);
        throw new Error(`Falha ao salvar status completed: ${downloadError.message}`);
      }
    }

    finalStatus = 'completed';
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [VOD] SUCESSO: ${channel.name} em ${duration}s - ${r2Url}`);
    
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    finalError = error.message?.substring(0, 500) || 'Erro desconhecido';
    console.error(`❌ [VOD] Falha: ${channel.name} após ${duration}s - ${finalError}`);
  } finally {
    // SEMPRE garantir que o status final seja salvo
    if (finalStatus !== 'completed') {
      try {
        console.log(`⚠️ [VOD] Salvando status de falha: ${finalError}`);
        await supabase
          .from('vod_downloads')
          .update({ 
            status: 'failed', 
            error_message: finalError || 'Processo encerrado sem completar'
          })
          .eq('id', downloadId);
      } catch (updateError: any) {
        console.error(`❌ [VOD] Erro ao salvar status de falha:`, updateError.message);
      }
    }
  }
}

async function downloadHLSVOD(channel: any, downloadId: string, supabase: any): Promise<void> {
  const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN')!;
  const manifestResponse = await fetchWithTimeout(channel.stream_url, 30000);
  if (!manifestResponse.ok) throw new Error(`Manifest: ${manifestResponse.status}`);

  const manifestContent = await manifestResponse.text();
  const baseUrl = channel.stream_url.substring(0, channel.stream_url.lastIndexOf('/') + 1);
  const lines = manifestContent.split('\n');
  const segments: { index: number; url: string; line: string }[] = [];
  let segmentIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      segments.push({ index: segmentIndex++, url: trimmed.startsWith('http') ? trimmed : baseUrl + trimmed, line: trimmed });
    }
  }

  console.log(`📊 [HLS] ${segments.length} segmentos`);
  await supabase.from('vod_downloads').update({ segment_count: segments.length, segments_downloaded: 0 }).eq('id', downloadId);

  let totalBytes = 0, downloaded = 0;
  const PARALLEL = 10;
  let lastUpdate = Date.now();

  for (let i = 0; i < segments.length; i += PARALLEL) {
    const batch = segments.slice(i, i + PARALLEL);
    await Promise.all(batch.map(async (seg) => {
      for (let retry = 0; retry < 3; retry++) {
        try {
          const res = await fetchWithTimeout(seg.url, 120000);
          if (!res.ok) throw new Error(`${res.status}`);
          const data = await res.arrayBuffer();
          totalBytes += data.byteLength;
          await uploadToR2(`vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`, new Uint8Array(data), 'video/mp2t', 'public, max-age=31536000, immutable');
          downloaded++;
          break;
        } catch (e) {
          if (retry === 2) console.error(`❌ Segment ${seg.index} failed`);
        }
      }
    }));

    if (Date.now() - lastUpdate > 1000) {
      lastUpdate = Date.now();
      await supabase.from('vod_downloads').update({ segments_downloaded: downloaded, file_size_bytes: totalBytes }).eq('id', downloadId);
      console.log(`📈 [HLS] ${Math.round((downloaded / segments.length) * 100)}%`);
    }
  }

  let newManifest = manifestContent;
  for (const seg of segments) {
    newManifest = newManifest.replace(seg.line, `https://${r2Domain}/vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`);
  }
  await uploadToR2(`vod/${channel.id}/playlist.m3u8`, new TextEncoder().encode(newManifest), 'application/vnd.apple.mpegurl', 'public, max-age=3600');
  console.log(`✅ [HLS] ${downloaded}/${segments.length} segmentos, ${(totalBytes / 1048576).toFixed(1)} MB`);
}

// NOVA FUNÇÃO: Download direto usando SEMPRE multipart para evitar OOM
async function downloadDirectVOD(channel: any, downloadId: string, supabase: any): Promise<void> {
  console.log(`📥 [Direct] Iniciando download: ${channel.name}`);
  console.log(`📥 [Direct] URL: ${channel.stream_url.substring(0, 80)}...`);
  
  // Tentar obter tamanho via HEAD, mas não falhar se não funcionar
  let contentLength = 0;
  let supportsRanges = false;
  
  try {
    console.log(`🔍 [Direct] Verificando tamanho do arquivo...`);
    const headRes = await fetchWithTimeout(channel.stream_url, 15000, 'HEAD');
    
    if (headRes.ok) {
      contentLength = parseInt(headRes.headers.get('content-length') || '0');
      supportsRanges = headRes.headers.get('accept-ranges') === 'bytes';
      console.log(`📊 [Direct] HEAD OK - Tamanho: ${(contentLength / 1048576).toFixed(1)} MB, Ranges: ${supportsRanges}`);
    } else {
      console.log(`⚠️ [Direct] HEAD retornou ${headRes.status}, tentando GET parcial...`);
      // Tentar GET com Range para obter tamanho
      const rangeRes = await fetchWithTimeout(channel.stream_url + '?t=' + Date.now(), 15000, 'GET');
      if (rangeRes.ok) {
        const rangeHeader = rangeRes.headers.get('content-range');
        if (rangeHeader) {
          const match = rangeHeader.match(/\/(\d+)$/);
          if (match) contentLength = parseInt(match[1]);
        }
        if (!contentLength) {
          contentLength = parseInt(rangeRes.headers.get('content-length') || '0');
        }
        console.log(`📊 [Direct] GET OK - Tamanho estimado: ${(contentLength / 1048576).toFixed(1)} MB`);
      }
      await rangeRes.body?.cancel(); // Cancelar o body para não baixar tudo
    }
  } catch (headError: any) {
    console.log(`⚠️ [Direct] Erro ao obter tamanho: ${headError.message}, continuando sem tamanho conhecido...`);
  }
  
  // Se não conseguiu tamanho, usar streaming mode
  if (contentLength === 0) {
    console.log(`📥 [Direct] Sem tamanho conhecido, usando streaming mode...`);
    await downloadStreamingMode(channel, downloadId, supabase);
    return;
  }

  console.log(`📊 [Direct] Tamanho final: ${(contentLength / 1048576).toFixed(1)} MB`);

  // CRÍTICO: Usar chunks menores (10MB) para evitar estouro de memória
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const totalChunks = Math.ceil(contentLength / CHUNK_SIZE);

  await supabase.from('vod_downloads').update({ 
    segment_count: totalChunks, 
    segments_downloaded: 0, 
    file_size_bytes: contentLength 
  }).eq('id', downloadId);

  const urlPath = new URL(channel.stream_url).pathname;
  const ext = urlPath.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;

  console.log(`📥 [Direct] Multipart streaming: ${totalChunks} chunks de ${(CHUNK_SIZE / 1048576).toFixed(0)}MB`);
  
  const uploadId = await initiateMultipartUpload(r2Key, contentType);
  console.log(`🔑 Upload ID: ${uploadId.substring(0, 16)}...`);

  const parts: { partNumber: number; etag: string }[] = [];
  let downloadedBytes = 0, completedChunks = 0, lastUpdate = Date.now();
  
  // Processar 2 chunks por vez para reduzir uso de memória
  const PARALLEL = 2;

  try {
    for (let i = 0; i < totalChunks; i += PARALLEL) {
      const chunkPromises: Promise<{ partNumber: number; etag: string; bytes: number }>[] = [];

      for (let j = 0; j < PARALLEL && i + j < totalChunks; j++) {
        const idx = i + j;
        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE - 1, contentLength - 1);
        chunkPromises.push(downloadAndUploadChunk(channel.stream_url, start, end, r2Key, uploadId, idx + 1));
      }

      const results = await Promise.all(chunkPromises);
      for (const r of results) {
        parts.push({ partNumber: r.partNumber, etag: r.etag });
        downloadedBytes += r.bytes;
        completedChunks++;
      }

      // Atualizar progresso
      if (Date.now() - lastUpdate > 2000 || completedChunks === totalChunks) {
        lastUpdate = Date.now();
        const progress = Math.round((completedChunks / totalChunks) * 100);
        await supabase.from('vod_downloads').update({ 
          segments_downloaded: completedChunks, 
          file_size_bytes: downloadedBytes 
        }).eq('id', downloadId);
        console.log(`📈 [Direct] ${progress}% - ${completedChunks}/${totalChunks} chunks (${(downloadedBytes / 1048576).toFixed(1)} MB)`);
      }
    }

    // Ordenar parts e finalizar
    parts.sort((a, b) => a.partNumber - b.partNumber);
    
    console.log(`⬆️ [Direct] Finalizando multipart upload...`);
    await supabase.from('vod_downloads').update({ status: 'processing' }).eq('id', downloadId);
    
    await completeMultipartUpload(r2Key, uploadId, parts);
    console.log(`✅ [Direct] Upload completo: ${(downloadedBytes / 1048576).toFixed(1)} MB em ${totalChunks} chunks`);
    
  } catch (error) {
    console.error(`❌ [Direct] Erro no multipart, abortando...`);
    await abortMultipartUpload(r2Key, uploadId);
    throw error;
  }
}

// Função otimizada: baixa e faz upload de chunk imediatamente, sem acumular na memória
async function downloadAndUploadChunk(
  url: string, 
  start: number, 
  end: number, 
  r2Key: string, 
  uploadId: string, 
  partNumber: number
): Promise<{ partNumber: number; etag: string; bytes: number }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Download do chunk
      const res = await fetch(url, {
        headers: { 
          'Range': `bytes=${start}-${end}`, 
          'User-Agent': 'VOD-Downloader/3.0' 
        },
        signal: AbortSignal.timeout(180000), // 3 min timeout por chunk
      });
      
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      // Ler dados diretamente como Uint8Array
      const data = new Uint8Array(await res.arrayBuffer());
      const bytes = data.length;
      
      // Upload imediato para R2
      const etag = await uploadPart(r2Key, uploadId, partNumber, data);
      
      // Chunk processado com sucesso
      return { partNumber, etag, bytes };
      
    } catch (e: any) {
      console.error(`⚠️ Chunk ${partNumber} tentativa ${attempt}/3: ${e.message}`);
      if (attempt === 3) {
        throw new Error(`Chunk ${partNumber} falhou após 3 tentativas: ${e.message}`);
      }
      // Backoff exponencial
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`Chunk ${partNumber} falhou`);
}

async function fetchWithTimeout(url: string, timeoutMs: number, method = 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { 
      method, 
      signal: controller.signal, 
      headers: { 'User-Agent': 'VOD-Downloader/3.0' } 
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Streaming mode: baixa o arquivo inteiro quando não sabemos o tamanho
async function downloadStreamingMode(channel: any, downloadId: string, supabase: any): Promise<void> {
  console.log(`📥 [Streaming] Iniciando download sem tamanho conhecido...`);
  
  const urlPath = new URL(channel.stream_url).pathname;
  const ext = urlPath.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;
  
  // Baixar o arquivo em chunks e fazer upload progressivo
  const response = await fetch(channel.stream_url, {
    headers: { 'User-Agent': 'VOD-Downloader/3.0' },
    signal: AbortSignal.timeout(600000), // 10 min timeout total
  });
  
  if (!response.ok) {
    throw new Error(`Download falhou: HTTP ${response.status}`);
  }
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Não foi possível criar reader do stream');
  }
  
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let lastUpdate = Date.now();
  const CHUNK_THRESHOLD = 50 * 1024 * 1024; // Fazer upload quando acumular 50MB
  
  const uploadId = await initiateMultipartUpload(r2Key, contentType);
  const parts: { partNumber: number; etag: string }[] = [];
  let partNumber = 1;
  let currentBuffer: Uint8Array[] = [];
  let currentBufferSize = 0;
  
  console.log(`🔑 [Streaming] Upload ID: ${uploadId.substring(0, 16)}...`);
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      currentBuffer.push(value);
      currentBufferSize += value.length;
      totalBytes += value.length;
      
      // Fazer upload quando acumular threshold
      if (currentBufferSize >= CHUNK_THRESHOLD) {
        console.log(`⬆️ [Streaming] Enviando parte ${partNumber} (${(currentBufferSize / 1048576).toFixed(1)} MB)...`);
        
        // Concatenar chunks do buffer
        const combined = new Uint8Array(currentBufferSize);
        let offset = 0;
        for (const chunk of currentBuffer) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        
        const etag = await uploadPart(r2Key, uploadId, partNumber, combined);
        parts.push({ partNumber, etag });
        partNumber++;
        
        // Limpar buffer
        currentBuffer = [];
        currentBufferSize = 0;
      }
      
      // Atualizar progresso
      if (Date.now() - lastUpdate > 3000) {
        lastUpdate = Date.now();
        await supabase.from('vod_downloads').update({ 
          file_size_bytes: totalBytes,
          segments_downloaded: parts.length
        }).eq('id', downloadId);
        console.log(`📈 [Streaming] ${(totalBytes / 1048576).toFixed(1)} MB baixados, ${parts.length} partes enviadas`);
      }
    }
    
    // Enviar último buffer se houver
    if (currentBufferSize > 0) {
      console.log(`⬆️ [Streaming] Enviando última parte ${partNumber} (${(currentBufferSize / 1048576).toFixed(1)} MB)...`);
      
      const combined = new Uint8Array(currentBufferSize);
      let offset = 0;
      for (const chunk of currentBuffer) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      const etag = await uploadPart(r2Key, uploadId, partNumber, combined);
      parts.push({ partNumber, etag });
    }
    
    // Finalizar upload
    console.log(`⬆️ [Streaming] Finalizando multipart upload...`);
    await supabase.from('vod_downloads').update({ status: 'processing' }).eq('id', downloadId);
    
    parts.sort((a, b) => a.partNumber - b.partNumber);
    await completeMultipartUpload(r2Key, uploadId, parts);
    
    console.log(`✅ [Streaming] Upload completo: ${(totalBytes / 1048576).toFixed(1)} MB em ${parts.length} partes`);
    
    // Atualizar tamanho final
    await supabase.from('vod_downloads').update({ 
      file_size_bytes: totalBytes,
      segment_count: parts.length,
      segments_downloaded: parts.length
    }).eq('id', downloadId);
    
  } catch (error) {
    console.error(`❌ [Streaming] Erro, abortando multipart...`);
    await abortMultipartUpload(r2Key, uploadId);
    throw error;
  }
}
