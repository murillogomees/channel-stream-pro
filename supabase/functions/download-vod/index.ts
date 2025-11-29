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

// Download direto usando streaming + multipart para evitar OOM
async function downloadDirectVOD(channel: any, downloadId: string, supabase: any): Promise<void> {
  console.log(`📥 [Direct] Iniciando download: ${channel.name}`);
  console.log(`📥 [Direct] URL: ${channel.stream_url.substring(0, 80)}...`);
  
  // Tentar obter tamanho via HEAD
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
      console.log(`⚠️ [Direct] HEAD retornou ${headRes.status}`);
    }
  } catch (headError: any) {
    console.log(`⚠️ [Direct] Erro ao obter tamanho: ${headError.message}`);
  }
  
  // SEMPRE usar streaming mode - mais confiável e evita OOM
  console.log(`📥 [Direct] Usando streaming mode para evitar OOM...`);
  await downloadStreamingMode(channel, downloadId, supabase, contentLength);
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

// Streaming mode: baixa e faz upload em chunks pequenos para evitar OOM
async function downloadStreamingMode(channel: any, downloadId: string, supabase: any, knownSize = 0): Promise<void> {
  console.log(`📥 [Streaming] Iniciando download... ${knownSize > 0 ? `(${(knownSize / 1048576).toFixed(1)} MB esperado)` : '(tamanho desconhecido)'}`);
  
  const urlPath = new URL(channel.stream_url).pathname;
  const ext = urlPath.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;
  
  // CRÍTICO: Usar chunks de 5MB (mínimo para R2 multipart) para evitar OOM
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB - mínimo para multipart
  
  const response = await fetch(channel.stream_url, {
    headers: { 'User-Agent': 'VOD-Downloader/4.0' },
    signal: AbortSignal.timeout(1800000), // 30 min timeout
  });
  
  if (!response.ok) {
    throw new Error(`Download falhou: HTTP ${response.status}`);
  }
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Não foi possível criar reader do stream');
  }
  
  // Atualizar status
  if (knownSize > 0) {
    await supabase.from('vod_downloads').update({ 
      file_size_bytes: knownSize,
      segment_count: Math.ceil(knownSize / CHUNK_SIZE)
    }).eq('id', downloadId);
  }
  
  const uploadId = await initiateMultipartUpload(r2Key, contentType);
  const parts: { partNumber: number; etag: string }[] = [];
  let partNumber = 1;
  let totalBytes = 0;
  let bufferSize = 0;
  let buffer: Uint8Array | null = new Uint8Array(CHUNK_SIZE);
  let lastUpdate = Date.now();
  
  console.log(`🔑 [Streaming] Upload ID: ${uploadId.substring(0, 16)}... (chunks de ${(CHUNK_SIZE / 1048576).toFixed(0)}MB)`);
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      // Copiar dados para buffer
      const remaining = CHUNK_SIZE - bufferSize;
      
      if (value.length <= remaining) {
        // Cabe tudo no buffer atual
        buffer!.set(value, bufferSize);
        bufferSize += value.length;
        totalBytes += value.length;
      } else {
        // Precisa dividir
        const firstPart = value.slice(0, remaining);
        buffer!.set(firstPart, bufferSize);
        bufferSize = CHUNK_SIZE;
        totalBytes += firstPart.length;
        
        // Buffer cheio - fazer upload
        console.log(`⬆️ [Streaming] Parte ${partNumber} (${(bufferSize / 1048576).toFixed(1)} MB)...`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer!.slice(0, bufferSize));
        parts.push({ partNumber, etag });
        partNumber++;
        
        // Resetar buffer e copiar resto
        const secondPart = value.slice(remaining);
        buffer = new Uint8Array(CHUNK_SIZE);
        buffer.set(secondPart, 0);
        bufferSize = secondPart.length;
        totalBytes += secondPart.length;
      }
      
      // Upload quando buffer cheio
      if (bufferSize >= CHUNK_SIZE) {
        console.log(`⬆️ [Streaming] Parte ${partNumber} (${(bufferSize / 1048576).toFixed(1)} MB)...`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer!.slice(0, bufferSize));
        parts.push({ partNumber, etag });
        partNumber++;
        
        // Criar novo buffer (não reutilizar para evitar referências)
        buffer = new Uint8Array(CHUNK_SIZE);
        bufferSize = 0;
      }
      
      // Atualizar progresso
      if (Date.now() - lastUpdate > 5000) {
        lastUpdate = Date.now();
        const progress = knownSize > 0 ? Math.round((totalBytes / knownSize) * 100) : 0;
        await supabase.from('vod_downloads').update({ 
          file_size_bytes: totalBytes,
          segments_downloaded: parts.length
        }).eq('id', downloadId);
        console.log(`📈 [Streaming] ${(totalBytes / 1048576).toFixed(1)} MB${knownSize > 0 ? ` (${progress}%)` : ''}, ${parts.length} partes`);
      }
    }
    
    // Enviar último buffer se houver (mínimo 5MB para R2)
    if (bufferSize > 0) {
      // Se for a única parte OU >= 5MB, fazer upload
      if (parts.length === 0 || bufferSize >= CHUNK_SIZE) {
        console.log(`⬆️ [Streaming] Última parte ${partNumber} (${(bufferSize / 1048576).toFixed(1)} MB)...`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer!.slice(0, bufferSize));
        parts.push({ partNumber, etag });
      } else if (bufferSize < CHUNK_SIZE && bufferSize >= 5 * 1024 * 1024) {
        // Parte >= 5MB, pode enviar
        console.log(`⬆️ [Streaming] Última parte ${partNumber} (${(bufferSize / 1048576).toFixed(1)} MB)...`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer!.slice(0, bufferSize));
        parts.push({ partNumber, etag });
      } else {
        // Parte muito pequena - R2 requer mínimo 5MB para partes intermediárias
        // Mas a última parte pode ser menor, então sempre enviamos
        console.log(`⬆️ [Streaming] Última parte ${partNumber} (${(bufferSize / 1048576).toFixed(2)} MB - permitido para parte final)...`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer!.slice(0, bufferSize));
        parts.push({ partNumber, etag });
      }
    }
    
    // Liberar memória
    buffer = null;
    
    // Finalizar upload
    console.log(`⬆️ [Streaming] Finalizando multipart upload com ${parts.length} partes...`);
    await supabase.from('vod_downloads').update({ status: 'processing' }).eq('id', downloadId);
    
    parts.sort((a, b) => a.partNumber - b.partNumber);
    await completeMultipartUpload(r2Key, uploadId, parts);
    
    console.log(`✅ [Streaming] Upload completo: ${(totalBytes / 1048576).toFixed(1)} MB em ${parts.length} partes`);
    
    await supabase.from('vod_downloads').update({ 
      file_size_bytes: totalBytes,
      segment_count: parts.length,
      segments_downloaded: parts.length
    }).eq('id', downloadId);
    
  } catch (error) {
    buffer = null; // Liberar memória
    console.error(`❌ [Streaming] Erro, abortando multipart...`);
    await abortMultipartUpload(r2Key, uploadId);
    throw error;
  }
}
