import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-player-active',
};

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

// ============= CONFIGURAÇÃO SIMPLIFICADA E ROBUSTA =============
const R2_PART_SIZE = 5 * 1024 * 1024;      // 5MB (mínimo R2)
const UPLOAD_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB buffer antes de upload
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB máximo
const EXECUTION_TIMEOUT = 50000;            // 50 segundos
const FETCH_TIMEOUT = 30000;                // 30s timeout por request
const MAX_RETRIES = 2;
const PROGRESS_UPDATE_INTERVAL = 3000;      // 3 segundos

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

// Upload simples para arquivos pequenos
async function uploadToR2Simple(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const client = getR2Client();
  const endpoint = getR2Endpoint();
  
  const response = await client.fetch(`${endpoint}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
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
    throw new Error(`Failed to initiate multipart upload: ${response.status}`);
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
    throw new Error(`Failed to upload part ${partNumber}: ${response.status}`);
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
    // Auth verification
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
    const { channelId, batch = false, channelIds = [], resume = false, downloadId, pauseAll = false, resumeAll = false } = body;

    // Pausar todos downloads
    if (pauseAll) {
      console.log(`⏸️ [VOD] Pausando todos downloads`);
      await supabaseService.from('vod_downloads')
        .update({ status: 'paused', error_message: 'Pausado manualmente' })
        .in('status', ['downloading', 'processing', 'queued']);
      return new Response(JSON.stringify({ success: true, message: 'Downloads pausados' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Retomar todos downloads
    if (resumeAll) {
      console.log(`▶️ [VOD] Retomando downloads pausados`);
      const { data: paused } = await supabaseService.from('vod_downloads')
        .select('id')
        .eq('status', 'paused')
        .limit(3);
      
      if (paused && paused.length > 0) {
        for (const d of paused) {
          EdgeRuntime.waitUntil(processResumeDownload(d.id, supabaseService));
        }
      }
      return new Response(JSON.stringify({ success: true, resumed: paused?.length || 0 }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Retomar download específico
    if (resume && downloadId) {
      console.log(`🔄 [VOD] Retomando: ${downloadId}`);
      EdgeRuntime.waitUntil(processResumeDownload(downloadId, supabaseService));
      return new Response(JSON.stringify({ success: true, downloadId }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Modo batch
    if (batch && channelIds.length > 0) {
      console.log(`🚀 [VOD] Batch: ${channelIds.length} canais`);
      EdgeRuntime.waitUntil(processBatchDownloads(channelIds.slice(0, 3), supabaseService));
      return new Response(JSON.stringify({ success: true, queued: Math.min(channelIds.length, 3) }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download individual
    if (!channelId) {
      return new Response(JSON.stringify({ error: 'channelId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: channel, error: channelError } = await supabaseService.from('m3u_channels').select('*').eq('id', channelId).maybeSingle();
    if (channelError || !channel) throw new Error(`Canal não encontrado`);
    if (!channel.is_vod) throw new Error('Canal não é VOD');

    // Verificar se já foi enviado ao R2
    if (channel.r2_uploaded) {
      return new Response(JSON.stringify({ error: 'Já enviado ao R2', r2Url: channel.r2_url }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar se mesma URL já está no R2
    const { data: sameUrlUploaded } = await supabaseService
      .from('m3u_channels')
      .select('id, r2_url')
      .eq('stream_url', channel.stream_url)
      .eq('r2_uploaded', true)
      .neq('id', channelId)
      .maybeSingle();

    if (sameUrlUploaded?.r2_url) {
      await supabaseService.from('m3u_channels').update({ 
        r2_uploaded: true, 
        r2_url: sameUrlUploaded.r2_url, 
        r2_uploaded_at: new Date().toISOString() 
      }).eq('id', channelId);
      return new Response(JSON.stringify({ success: true, linked: true, r2Url: sameUrlUploaded.r2_url }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar download existente
    const { data: existingDownload } = await supabaseService
      .from('vod_downloads')
      .select('id, status')
      .eq('channel_id', channelId)
      .in('status', ['queued', 'downloading', 'processing', 'paused'])
      .maybeSingle();

    if (existingDownload) {
      return new Response(JSON.stringify({ error: 'Download em andamento', downloadId: existingDownload.id }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Criar registro de download
    const { data: downloadRecord, error: insertError } = await supabaseService.from('vod_downloads').insert({
      channel_id: channelId,
      original_url: channel.stream_url,
      status: 'queued',
      download_started_at: new Date().toISOString()
    }).select().single();

    if (insertError || !downloadRecord?.id) {
      throw new Error(`Falha ao criar registro: ${insertError?.message}`);
    }

    console.log(`🎬 [VOD] Iniciando: ${channel.name}`);
    EdgeRuntime.waitUntil(processDownload(channel, downloadRecord.id, supabaseService));

    return new Response(JSON.stringify({ success: true, downloadId: downloadRecord.id }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('❌ [VOD] Erro:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processBatchDownloads(channelIds: string[], supabase: any): Promise<void> {
  for (const channelId of channelIds) {
    try {
      const { data: channel } = await supabase.from('m3u_channels').select('*').eq('id', channelId).maybeSingle();
      if (!channel?.is_vod || channel.r2_uploaded) continue;

      // Verificar duplicados
      const { data: existing } = await supabase
        .from('vod_downloads')
        .select('id')
        .eq('channel_id', channelId)
        .in('status', ['queued', 'downloading', 'processing', 'paused'])
        .maybeSingle();
      
      if (existing) continue;

      const { data: downloadRecord } = await supabase.from('vod_downloads').insert({
        channel_id: channelId,
        original_url: channel.stream_url,
        status: 'queued',
        download_started_at: new Date().toISOString()
      }).select().single();

      if (downloadRecord?.id) {
        await processDownload(channel, downloadRecord.id, supabase);
      }
    } catch (err) {
      console.error(`❌ [Batch] ${channelId}:`, err);
    }
  }
}

async function processResumeDownload(downloadId: string, supabase: any): Promise<void> {
  const { data: download } = await supabase
    .from('vod_downloads')
    .select('*, m3u_channels!inner(*)')
    .eq('id', downloadId)
    .single();

  if (!download) return;

  await processDownload(download.m3u_channels, downloadId, supabase, download.metadata);
}

async function processDownload(channel: any, downloadId: string, supabase: any, resumeMetadata?: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    await supabase.from('vod_downloads').update({ status: 'downloading' }).eq('id', downloadId);
    console.log(`📥 [VOD] Processando: ${channel.name}`);

    const isHLS = channel.stream_url.includes('.m3u8');
    
    if (isHLS) {
      await downloadHLS(channel, downloadId, supabase);
    } else {
      await downloadFile(channel, downloadId, supabase, resumeMetadata);
    }

    // Sucesso - atualizar canal
    let r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN')?.replace(/^https?:\/\//, '');
    const ext = new URL(channel.stream_url).pathname.split('.').pop() || 'mp4';
    const r2Url = isHLS 
      ? `https://${r2Domain}/vod/${channel.id}/playlist.m3u8` 
      : `https://${r2Domain}/vod/${channel.id}/video.${ext}`;

    await supabase.from('m3u_channels').update({ 
      r2_uploaded: true, 
      r2_url: r2Url, 
      r2_uploaded_at: new Date().toISOString() 
    }).eq('id', channel.id);

    // Atualizar outros canais com mesma URL
    await supabase.from('m3u_channels').update({ 
      r2_uploaded: true, 
      r2_url: r2Url, 
      r2_uploaded_at: new Date().toISOString() 
    }).eq('stream_url', channel.stream_url).eq('r2_uploaded', false);

    await supabase.from('vod_downloads').update({ 
      status: 'completed', 
      r2_url: r2Url, 
      download_completed_at: new Date().toISOString(),
      metadata: null 
    }).eq('id', downloadId);

    console.log(`✅ [VOD] ${channel.name} em ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  } catch (error: any) {
    console.error(`❌ [VOD] Falha: ${channel.name} - ${error.message}`);
    
    await supabase.from('vod_downloads').update({ 
      status: 'failed', 
      error_message: error.message?.substring(0, 200) 
    }).eq('id', downloadId);
  }
}

async function downloadFile(channel: any, downloadId: string, supabase: any, resumeMetadata?: any): Promise<void> {
  const ext = new URL(channel.stream_url).pathname.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;

  // Tentar obter tamanho
  let contentLength = 0;
  let supportsRanges = false;
  
  try {
    const headRes = await fetch(channel.stream_url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    if (headRes.ok) {
      contentLength = parseInt(headRes.headers.get('content-length') || '0');
      supportsRanges = headRes.headers.get('accept-ranges') === 'bytes';
    }
  } catch (e) {
    console.log(`⚠️ [VOD] HEAD falhou, usando streaming`);
  }

  if (contentLength > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande: ${(contentLength / 1073741824).toFixed(1)}GB`);
  }

  console.log(`📊 [VOD] Tamanho: ${contentLength > 0 ? (contentLength / 1048576).toFixed(1) + 'MB' : 'desconhecido'}, Ranges: ${supportsRanges}`);

  // Arquivos pequenos (<10MB) - upload direto
  if (contentLength > 0 && contentLength < 10 * 1024 * 1024) {
    console.log(`⚡ [VOD] Upload direto`);
    const response = await fetch(channel.stream_url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!response.ok) throw new Error(`Download falhou: ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    await uploadToR2Simple(r2Key, data, contentType);
    await supabase.from('vod_downloads').update({ file_size_bytes: data.length }).eq('id', downloadId);
    return;
  }

  // Arquivos grandes - multipart upload com streaming
  let uploadId = resumeMetadata?.upload_id;
  let parts: { partNumber: number; etag: string }[] = resumeMetadata?.parts || [];
  let partNumber = parts.length + 1;
  let totalBytes = resumeMetadata?.total_bytes || 0;

  if (!uploadId) {
    uploadId = await initiateMultipartUpload(r2Key, contentType);
    console.log(`🔑 [VOD] Upload ID: ${uploadId.substring(0, 16)}...`);
  }

  try {
    const startExecution = Date.now();
    let buffer = new Uint8Array(0);
    let lastUpdate = Date.now();

    // Download com streaming
    const response = await fetch(channel.stream_url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!response.ok) throw new Error(`Download falhou: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível criar reader');

    let done = false;
    
    while (!done) {
      // Verificar timeout
      if (Date.now() - startExecution > EXECUTION_TIMEOUT) {
        console.log(`⏸️ [VOD] Timeout, salvando progresso: ${(totalBytes / 1048576).toFixed(1)}MB`);
        
        // Salvar buffer restante se for suficiente
        if (buffer.length >= R2_PART_SIZE) {
          const partData = buffer.slice(0, R2_PART_SIZE);
          const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
          parts.push({ partNumber, etag });
          buffer = buffer.slice(R2_PART_SIZE);
          partNumber++;
        }
        
        await supabase.from('vod_downloads').update({
          status: 'paused',
          file_size_bytes: totalBytes,
          metadata: { upload_id: uploadId, parts, total_bytes: totalBytes, pending_buffer: buffer.length }
        }).eq('id', downloadId);
        
        // Agendar retomada
        scheduleResume(downloadId);
        reader.cancel();
        return;
      }

      const result = await reader.read();
      done = result.done;
      
      if (result.value) {
        // Concatenar ao buffer
        const newBuffer = new Uint8Array(buffer.length + result.value.length);
        newBuffer.set(buffer);
        newBuffer.set(result.value, buffer.length);
        buffer = newBuffer;
        totalBytes += result.value.length;

        // Upload quando buffer atingir tamanho
        while (buffer.length >= UPLOAD_BUFFER_SIZE) {
          const partData = buffer.slice(0, UPLOAD_BUFFER_SIZE);
          console.log(`⬆️ [VOD] Parte ${partNumber}: ${(partData.length / 1048576).toFixed(1)}MB`);
          
          const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
          parts.push({ partNumber, etag });
          buffer = buffer.slice(UPLOAD_BUFFER_SIZE);
          partNumber++;
        }

        // Atualizar progresso
        if (Date.now() - lastUpdate > PROGRESS_UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          const progress = contentLength > 0 ? Math.round((totalBytes / contentLength) * 100) : 0;
          await supabase.from('vod_downloads').update({
            file_size_bytes: totalBytes,
            segments_downloaded: parts.length,
            metadata: { upload_id: uploadId, parts, total_bytes: totalBytes }
          }).eq('id', downloadId);
          console.log(`📈 [VOD] ${(totalBytes / 1048576).toFixed(1)}MB ${contentLength > 0 ? `(${progress}%)` : ''}`);
        }
      }
    }

    // Upload do buffer restante
    if (buffer.length > 0) {
      // Se buffer for muito pequeno (<5MB) e tivermos partes, juntar com a última
      if (buffer.length < R2_PART_SIZE && parts.length > 0) {
        console.log(`⬆️ [VOD] Parte final: ${(buffer.length / 1048576).toFixed(1)}MB`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer);
        parts.push({ partNumber, etag });
      } else if (buffer.length >= R2_PART_SIZE || parts.length === 0) {
        console.log(`⬆️ [VOD] Parte final: ${(buffer.length / 1048576).toFixed(1)}MB`);
        const etag = await uploadPart(r2Key, uploadId, partNumber, buffer);
        parts.push({ partNumber, etag });
      }
    }

    // Completar multipart
    if (parts.length > 0) {
      console.log(`⬆️ [VOD] Finalizando ${parts.length} partes...`);
      parts.sort((a, b) => a.partNumber - b.partNumber);
      await completeMultipartUpload(r2Key, uploadId, parts);
    }

    await supabase.from('vod_downloads').update({ file_size_bytes: totalBytes }).eq('id', downloadId);
    console.log(`✅ [VOD] Upload completo: ${(totalBytes / 1048576).toFixed(1)}MB`);

  } catch (error) {
    console.error(`❌ [VOD] Erro no upload, abortando...`);
    if (uploadId) await abortMultipartUpload(r2Key, uploadId);
    throw error;
  }
}

async function downloadHLS(channel: any, downloadId: string, supabase: any): Promise<void> {
  const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN')?.replace(/^https?:\/\//, '');
  
  const manifestResponse = await fetch(channel.stream_url);
  if (!manifestResponse.ok) throw new Error(`Manifest: ${manifestResponse.status}`);

  const manifestContent = await manifestResponse.text();
  const baseUrl = channel.stream_url.substring(0, channel.stream_url.lastIndexOf('/') + 1);
  const lines = manifestContent.split('\n');
  const segments: { index: number; url: string; line: string }[] = [];
  let segmentIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      segments.push({ 
        index: segmentIndex++, 
        url: trimmed.startsWith('http') ? trimmed : baseUrl + trimmed, 
        line: trimmed 
      });
    }
  }

  console.log(`📊 [HLS] ${segments.length} segmentos`);
  await supabase.from('vod_downloads').update({ segment_count: segments.length }).eq('id', downloadId);

  let totalBytes = 0, downloaded = 0;
  const startExecution = Date.now();

  for (let i = 0; i < segments.length; i++) {
    if (Date.now() - startExecution > EXECUTION_TIMEOUT) {
      console.log(`⏸️ [HLS] Timeout em ${downloaded}/${segments.length}`);
      await supabase.from('vod_downloads').update({
        status: 'paused',
        segments_downloaded: downloaded,
        metadata: { downloaded_segments: downloaded }
      }).eq('id', downloadId);
      scheduleResume(downloadId);
      return;
    }

    const seg = segments[i];
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const res = await fetch(seg.url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.arrayBuffer();
        totalBytes += data.byteLength;
        
        await uploadToR2Simple(
          `vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`, 
          new Uint8Array(data), 
          'video/mp2t'
        );
        downloaded++;
        break;
      } catch (e) {
        if (retry === MAX_RETRIES - 1) console.error(`❌ Segment ${seg.index} failed`);
      }
    }

    if (i % 10 === 0) {
      await supabase.from('vod_downloads').update({ 
        segments_downloaded: downloaded, 
        file_size_bytes: totalBytes 
      }).eq('id', downloadId);
      console.log(`📈 [HLS] ${Math.round((downloaded / segments.length) * 100)}%`);
    }
  }

  // Reescrever manifest
  let newManifest = manifestContent;
  for (const seg of segments) {
    newManifest = newManifest.replace(
      seg.line, 
      `https://${r2Domain}/vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`
    );
  }
  
  await uploadToR2Simple(
    `vod/${channel.id}/playlist.m3u8`, 
    new TextEncoder().encode(newManifest), 
    'application/vnd.apple.mpegurl'
  );

  await supabase.from('vod_downloads').update({ 
    segments_downloaded: downloaded, 
    file_size_bytes: totalBytes 
  }).eq('id', downloadId);
  
  console.log(`✅ [HLS] ${downloaded}/${segments.length} segmentos, ${(totalBytes / 1048576).toFixed(1)}MB`);
}

function scheduleResume(downloadId: string): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  setTimeout(async () => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/download-vod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': cronSecret || ''
        },
        body: JSON.stringify({ resume: true, downloadId })
      });
    } catch (e) {
      console.error(`❌ Falha ao agendar retomada:`, e);
    }
  }, 3000);
}
