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

// ============= CONFIGURAÇÃO =============
const R2_PART_SIZE = 5 * 1024 * 1024;       // 5MB (mínimo R2)
const CHUNK_SIZE = 5 * 1024 * 1024;         // 5MB por chunk de download
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB máximo
const EXECUTION_TIMEOUT = 55000;            // 55 segundos max por execução (edge limit ~60s)
const FETCH_TIMEOUT_CHUNK = 30000;          // 30s timeout por chunk com range
const PROGRESS_UPDATE_INTERVAL = 3000;      // 3 segundos (mais frequente)
const MAX_RETRIES_PER_CHUNK = 3;            // Máximo de retries por chunk
const RETRY_BASE_DELAY = 1000;              // 1s delay base para retry
const CONNECTION_RETRY_DELAY = 2000;        // 2s antes de reconectar

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
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Upload part failed after retries');
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

// Extrair host da URL para circuit breaker
function extractHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
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
    const { channelId, batch = false, channelIds = [], resume = false, downloadId, pauseAll = false, resumeAll = false, completeUpload = false } = body;

    // Completar upload multipart travado
    if (completeUpload && downloadId) {
      console.log(`🔧 [VOD] Completando upload travado: ${downloadId}`);
      
      const { data: download, error: downloadError } = await supabaseService
        .from('vod_downloads')
        .select('*')
        .eq('id', downloadId)
        .maybeSingle();
      
      if (downloadError || !download) {
        return new Response(JSON.stringify({ error: 'Download não encontrado' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const metadata = download.metadata || {};
      const uploadId = metadata.upload_id;
      const parts = metadata.parts || [];
      
      if (!uploadId || parts.length === 0) {
        return new Response(JSON.stringify({ error: 'Sem dados de upload multipart para completar' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      try {
        // Buscar o canal para obter o R2 key
        const { data: channel } = await supabaseService
          .from('m3u_channels')
          .select('id, name, stream_url')
          .eq('id', download.channel_id)
          .maybeSingle();
        
        if (!channel) {
          return new Response(JSON.stringify({ error: 'Canal não encontrado' }), 
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const ext = download.original_url?.match(/\.(mp4|mkv|avi|ts|m3u8)$/i)?.[1] || 'mp4';
        const r2Key = `vod/${channel.id}/${channel.id}.${ext}`;
        const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN')?.replace(/^https?:\/\//, '');
        const r2Url = `https://${r2Domain}/${r2Key}`;
        
        console.log(`🔧 [VOD] Completando multipart: ${parts.length} partes, uploadId: ${uploadId.slice(0, 20)}...`);
        
        // Ordenar partes por partNumber
        const sortedParts = parts.map((p: any) => ({
          partNumber: p.partNumber,
          etag: p.etag
        })).sort((a: any, b: any) => a.partNumber - b.partNumber);
        
        // Completar o multipart upload
        await completeMultipartUpload(r2Key, uploadId, sortedParts);
        
        // Atualizar o download como completed
        await supabaseService.from('vod_downloads').update({
          status: 'completed',
          r2_url: r2Url,
          download_completed_at: new Date().toISOString(),
          error_message: null,
          metadata: { ...metadata, completed_manually: true }
        }).eq('id', downloadId);
        
        // Atualizar o canal
        await supabaseService.from('m3u_channels').update({
          r2_uploaded: true,
          r2_url: r2Url,
          r2_uploaded_at: new Date().toISOString()
        }).eq('id', channel.id);
        
        // Registrar sucesso no circuit breaker
        await supabaseService.rpc('record_host_success', { p_url: download.original_url });
        
        console.log(`✅ [VOD] Upload completado manualmente: ${channel.name}`);
        
        return new Response(JSON.stringify({ 
          success: true, 
          r2Url, 
          partsCount: sortedParts.length,
          message: 'Upload multipart completado com sucesso'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        
      } catch (e: any) {
        console.error(`❌ [VOD] Erro ao completar upload:`, e.message);
        return new Response(JSON.stringify({ error: e.message }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

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
        .order('updated_at', { ascending: false })
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

    // Verificar circuit breaker do host
    const host = extractHost(channel.stream_url);
    const { data: circuitStatus } = await supabaseService.rpc('check_host_circuit_breaker', { p_url: channel.stream_url });
    
    if (circuitStatus?.[0]?.is_blocked) {
      const blockedUntil = new Date(circuitStatus[0].blocked_until).toLocaleTimeString();
      return new Response(JSON.stringify({ 
        error: `Host ${host} bloqueado temporariamente até ${blockedUntil}`, 
        blocked_until: circuitStatus[0].blocked_until 
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar se já foi enviado ao R2
    if (channel.r2_uploaded) {
      return new Response(JSON.stringify({ error: 'Já enviado ao R2', r2Url: channel.r2_url }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar se mesma URL já está no R2 (deduplicação)
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
      console.log(`🔗 [VOD] Deduplicado por URL: ${channel.name}`);
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
      // Se está pausado, retomar
      if (existingDownload.status === 'paused') {
        EdgeRuntime.waitUntil(processResumeDownload(existingDownload.id, supabaseService));
        return new Response(JSON.stringify({ success: true, resumed: true, downloadId: existingDownload.id }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
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

      // Verificar circuit breaker
      const { data: circuitStatus } = await supabase.rpc('check_host_circuit_breaker', { p_url: channel.stream_url });
      if (circuitStatus?.[0]?.is_blocked) {
        console.log(`⚠️ [VOD] Host bloqueado, pulando: ${channel.name}`);
        continue;
      }

      const { data: existing } = await supabase
        .from('vod_downloads')
        .select('id, status')
        .eq('channel_id', channelId)
        .in('status', ['queued', 'downloading', 'processing', 'paused'])
        .maybeSingle();
      
      if (existing) {
        if (existing.status === 'paused') {
          await processResumeDownload(existing.id, supabase);
        }
        continue;
      }

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

  // Verificar circuit breaker antes de retomar
  const { data: circuitStatus } = await supabase.rpc('check_host_circuit_breaker', { p_url: download.original_url });
  if (circuitStatus?.[0]?.is_blocked) {
    console.log(`⚠️ [VOD] Host bloqueado, adiando resume: ${downloadId}`);
    return;
  }

  await processDownload(download.m3u_channels, downloadId, supabase, download.metadata);
}

async function processDownload(channel: any, downloadId: string, supabase: any, resumeMetadata?: any): Promise<void> {
  const startTime = Date.now();
  const host = extractHost(channel.stream_url);
  
  try {
    // Marcar início imediato
    await supabase.from('vod_downloads').update({ 
      status: 'downloading',
      updated_at: new Date().toISOString()
    }).eq('id', downloadId);
    
    console.log(`📥 [VOD] Processando: ${channel.name} (${host})`);

    const isHLS = channel.stream_url.includes('.m3u8');
    
    if (isHLS) {
      await downloadHLS(channel, downloadId, supabase);
    } else {
      await downloadFileWithReconnect(channel, downloadId, supabase, resumeMetadata);
    }

    // Sucesso - registrar no circuit breaker
    const duration = Date.now() - startTime;
    await supabase.rpc('record_host_success', { 
      p_url: channel.stream_url, 
      p_bytes: resumeMetadata?.downloaded_bytes || null,
      p_duration_ms: duration 
    });

    // Atualizar canal
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

    // Atualizar outros canais com mesma URL (deduplicação)
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
    
    // Registrar falha no circuit breaker (exceto pausas controladas)
    if (!error.message?.includes('PAUSE_FOR_RESUME')) {
      await supabase.rpc('record_host_failure', { p_url: channel.stream_url, p_error: error.message });
      
      await supabase.from('vod_downloads').update({ 
        status: 'failed', 
        error_message: error.message?.substring(0, 200),
        updated_at: new Date().toISOString()
      }).eq('id', downloadId);
    }
  }
}

// Download com reconexão automática
async function downloadFileWithReconnect(channel: any, downloadId: string, supabase: any, resumeMetadata?: any): Promise<void> {
  const ext = new URL(channel.stream_url).pathname.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;

  // Estado do download
  let contentLength = resumeMetadata?.content_length || 0;
  let supportsRanges = resumeMetadata?.supports_ranges || false;
  let uploadId = resumeMetadata?.upload_id;
  let parts: { partNumber: number; etag: string }[] = resumeMetadata?.parts || [];
  let downloadedBytes = resumeMetadata?.downloaded_bytes || 0;
  let partNumber = parts.length + 1;
  let buffer = new Uint8Array(0);
  let connectionRetries = resumeMetadata?.connection_retries || 0;
  const maxConnectionRetries = 5;
  
  // Obter tamanho total se não temos
  if (!contentLength) {
    try {
      const headRes = await fetch(channel.stream_url, { 
        method: 'HEAD', 
        signal: AbortSignal.timeout(10000) 
      });
      if (headRes.ok) {
        contentLength = parseInt(headRes.headers.get('content-length') || '0');
        supportsRanges = headRes.headers.get('accept-ranges') === 'bytes';
      }
    } catch (e) {
      console.log(`⚠️ [VOD] HEAD falhou, tentando download direto`);
    }
  }

  if (contentLength > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande: ${(contentLength / 1073741824).toFixed(1)}GB`);
  }

  console.log(`📊 [VOD] Tamanho: ${contentLength > 0 ? (contentLength / 1048576).toFixed(1) + 'MB' : 'desconhecido'}, Ranges: ${supportsRanges}, Retries: ${connectionRetries}`);

  // Atualizar estado inicial
  await supabase.from('vod_downloads').update({
    file_size_bytes: contentLength || null,
    updated_at: new Date().toISOString(),
    metadata: { started: true, content_length: contentLength, supports_ranges: supportsRanges }
  }).eq('id', downloadId);

  // Arquivos pequenos (<10MB) - upload direto
  if (contentLength > 0 && contentLength < 10 * 1024 * 1024) {
    console.log(`⚡ [VOD] Upload direto (arquivo pequeno)`);
    const response = await fetch(channel.stream_url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_CHUNK) });
    if (!response.ok) throw new Error(`Download falhou: ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    await uploadToR2Simple(r2Key, data, contentType);
    await supabase.from('vod_downloads').update({ file_size_bytes: data.length }).eq('id', downloadId);
    return;
  }

  // Iniciar multipart upload se não tiver
  if (!uploadId) {
    uploadId = await initiateMultipartUpload(r2Key, contentType);
    console.log(`🔑 [VOD] Upload ID: ${uploadId.substring(0, 20)}...`);
  } else {
    console.log(`🔄 [VOD] Retomando de ${(downloadedBytes / 1048576).toFixed(1)}MB, parte ${partNumber}, retry ${connectionRetries}`);
  }

  const startExecution = Date.now();
  let lastUpdate = Date.now();
  
  // Função para salvar estado e agendar retry
  const saveStateAndRetry = async (reason: string) => {
    // Upload buffer pendente se for grande o suficiente
    if (buffer.length >= R2_PART_SIZE) {
      try {
        const partData = buffer.slice(0, R2_PART_SIZE);
        const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
        parts.push({ partNumber, etag });
        buffer = buffer.slice(R2_PART_SIZE);
        partNumber++;
        console.log(`⬆️ [VOD] Parte ${partNumber-1} salva antes de pausar`);
      } catch (e) {
        console.log(`⚠️ [VOD] Não foi possível salvar parte antes de pausar`);
      }
    }
    
    await supabase.from('vod_downloads').update({
      status: 'paused',
      error_message: reason,
      file_size_bytes: contentLength || downloadedBytes,
      segments_downloaded: parts.length,
      metadata: { 
        upload_id: uploadId, 
        parts, 
        downloaded_bytes: downloadedBytes,
        content_length: contentLength,
        supports_ranges: supportsRanges,
        connection_retries: connectionRetries,
        buffer_size: buffer.length,
        reason
      }
    }).eq('id', downloadId);
    
    scheduleResumeImmediate(downloadId);
    throw new Error('PAUSE_FOR_RESUME');
  };

  try {
    // Download com Range headers se suportado
    if (supportsRanges && contentLength > 0 && downloadedBytes > 0) {
      // Continuar de onde parou com Range
      while (downloadedBytes < contentLength) {
        // Verificar timeout
        if (Date.now() - startExecution > EXECUTION_TIMEOUT) {
          console.log(`⏸️ [VOD] Timeout, pausando em ${(downloadedBytes / 1048576).toFixed(1)}MB`);
          await saveStateAndRetry('Timeout de execução');
        }

        const rangeStart = downloadedBytes;
        const rangeEnd = Math.min(downloadedBytes + CHUNK_SIZE - 1, contentLength - 1);
        
        console.log(`📥 [VOD] Range ${rangeStart}-${rangeEnd}`);

        let response: Response | null = null;
        for (let retry = 0; retry < MAX_RETRIES_PER_CHUNK; retry++) {
          try {
            response = await fetch(channel.stream_url, { 
              headers: { 'Range': `bytes=${rangeStart}-${rangeEnd}` },
              signal: AbortSignal.timeout(FETCH_TIMEOUT_CHUNK) 
            });
            
            if (response.ok || response.status === 206) break;
            throw new Error(`HTTP ${response.status}`);
          } catch (e: any) {
            if (retry === MAX_RETRIES_PER_CHUNK - 1) {
              console.log(`❌ [VOD] Chunk falhou após ${MAX_RETRIES_PER_CHUNK} tentativas`);
              throw e;
            }
            await new Promise(r => setTimeout(r, RETRY_BASE_DELAY * Math.pow(2, retry)));
          }
        }

        if (!response) throw new Error('Download falhou');

        const chunkData = new Uint8Array(await response.arrayBuffer());
        
        // Adicionar ao buffer
        const newBuffer = new Uint8Array(buffer.length + chunkData.length);
        newBuffer.set(buffer);
        newBuffer.set(chunkData, buffer.length);
        buffer = newBuffer;
        downloadedBytes += chunkData.length;

        // Upload quando buffer atingir tamanho mínimo
        while (buffer.length >= R2_PART_SIZE) {
          const partData = buffer.slice(0, R2_PART_SIZE);
          console.log(`⬆️ [VOD] Parte ${partNumber}: ${(partData.length / 1048576).toFixed(1)}MB`);
          
          const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
          parts.push({ partNumber, etag });
          buffer = buffer.slice(R2_PART_SIZE);
          partNumber++;
        }

        // Atualizar progresso
        if (Date.now() - lastUpdate > PROGRESS_UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          const progress = Math.round((downloadedBytes / contentLength) * 100);
          await supabase.from('vod_downloads').update({
            file_size_bytes: contentLength,
            segments_downloaded: parts.length,
            metadata: { upload_id: uploadId, parts, downloaded_bytes: downloadedBytes, content_length: contentLength, supports_ranges: true }
          }).eq('id', downloadId);
          console.log(`📈 [VOD] ${(downloadedBytes / 1048576).toFixed(1)}/${(contentLength / 1048576).toFixed(1)}MB (${progress}%)`);
        }
      }
    } else {
      // Streaming sem Range - precisa reconectar se falhar
      console.log(`📥 [VOD] Download via streaming (sem Range)`);
      
      let response: Response | null = null;
      for (let retry = 0; retry < MAX_RETRIES_PER_CHUNK; retry++) {
        try {
          response = await fetch(channel.stream_url);
          if (response.ok) break;
          throw new Error(`HTTP ${response.status}`);
        } catch (e: any) {
          if (retry === MAX_RETRIES_PER_CHUNK - 1) throw e;
          console.log(`⚠️ [VOD] Conexão falhou, tentativa ${retry + 1}...`);
          await new Promise(r => setTimeout(r, CONNECTION_RETRY_DELAY));
        }
      }
      
      if (!response) throw new Error('Não foi possível conectar');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Não foi possível obter stream reader');

      try {
        while (true) {
          // Verificar timeout
          if (Date.now() - startExecution > EXECUTION_TIMEOUT) {
            console.log(`⏸️ [VOD] Timeout durante streaming em ${(downloadedBytes / 1048576).toFixed(1)}MB`);
            reader.cancel();
            
            // Se temos partes, não perder o progresso
            if (parts.length > 0) {
              connectionRetries++;
              if (connectionRetries < maxConnectionRetries) {
                await saveStateAndRetry(`Timeout de execução - retry ${connectionRetries}`);
              }
            }
            
            await saveStateAndRetry('Timeout de execução');
          }

          let readResult: ReadableStreamReadResult<Uint8Array>;
          try {
            readResult = await reader.read();
          } catch (readError: any) {
            console.log(`⚠️ [VOD] Erro de leitura: ${readError.message}`);
            
            // Tentar finalizar com o que temos
            if (parts.length > 0 || buffer.length > 0) {
              connectionRetries++;
              
              if (connectionRetries < maxConnectionRetries) {
                console.log(`🔄 [VOD] Reconexão ${connectionRetries}/${maxConnectionRetries}...`);
                
                // Upload buffer atual se possível
                if (buffer.length >= R2_PART_SIZE) {
                  try {
                    const partData = buffer.slice(0, R2_PART_SIZE);
                    const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
                    parts.push({ partNumber, etag });
                    buffer = buffer.slice(R2_PART_SIZE);
                    partNumber++;
                  } catch {}
                }
                
                await saveStateAndRetry(`Conexão interrompida - retry ${connectionRetries}`);
              }
              
              // Último recurso: tentar finalizar com o que temos
              console.log(`🏁 [VOD] Tentando finalizar com ${parts.length} partes...`);
              break;
            }
            
            throw readError;
          }

          const { done, value } = readResult;
          
          if (done) {
            console.log(`📦 [VOD] Stream completo: ${(downloadedBytes / 1048576).toFixed(1)}MB`);
            break;
          }

          if (value) {
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;
            downloadedBytes += value.length;

            while (buffer.length >= R2_PART_SIZE) {
              const partData = buffer.slice(0, R2_PART_SIZE);
              console.log(`⬆️ [VOD] Parte ${partNumber}: ${(partData.length / 1048576).toFixed(1)}MB`);
              
              const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
              parts.push({ partNumber, etag });
              buffer = buffer.slice(R2_PART_SIZE);
              partNumber++;
            }

            if (Date.now() - lastUpdate > PROGRESS_UPDATE_INTERVAL) {
              lastUpdate = Date.now();
              await supabase.from('vod_downloads').update({
                file_size_bytes: downloadedBytes,
                segments_downloaded: parts.length,
                metadata: { upload_id: uploadId, parts, downloaded_bytes: downloadedBytes, supports_ranges: false }
              }).eq('id', downloadId);
              console.log(`📈 [VOD] Streaming: ${(downloadedBytes / 1048576).toFixed(1)}MB, ${parts.length} partes`);
            }
          }
        }
      } finally {
        try { reader.releaseLock(); } catch {}
      }
    }

    // Upload buffer restante
    if (buffer.length > 0) {
      console.log(`⬆️ [VOD] Parte final: ${(buffer.length / 1048576).toFixed(1)}MB`);
      const etag = await uploadPart(r2Key, uploadId, partNumber, buffer);
      parts.push({ partNumber, etag });
    }

    // Completar multipart
    if (parts.length > 0) {
      console.log(`🏁 [VOD] Finalizando ${parts.length} partes...`);
      parts.sort((a, b) => a.partNumber - b.partNumber);
      await completeMultipartUpload(r2Key, uploadId, parts);
    }

    await supabase.from('vod_downloads').update({ 
      file_size_bytes: downloadedBytes 
    }).eq('id', downloadId);
    
    console.log(`✅ [VOD] Upload completo: ${(downloadedBytes / 1048576).toFixed(1)}MB em ${parts.length} partes`);

  } catch (error: any) {
    if (error.message === 'PAUSE_FOR_RESUME') throw error;
    
    // Se temos partes, salvar para retry
    if (uploadId && parts.length > 0) {
      console.log(`⚠️ [VOD] Erro com ${parts.length} partes, salvando...`);
      connectionRetries++;
      
      if (connectionRetries < maxConnectionRetries) {
        await supabase.from('vod_downloads').update({
          status: 'paused',
          error_message: `${error.message} - ${parts.length} partes salvas`,
          file_size_bytes: downloadedBytes,
          segments_downloaded: parts.length,
          metadata: { 
            upload_id: uploadId, 
            parts, 
            downloaded_bytes: downloadedBytes,
            content_length: contentLength,
            supports_ranges: supportsRanges,
            connection_retries: connectionRetries,
            last_error: error.message
          }
        }).eq('id', downloadId);
        
        // Agendar retry em alguns segundos
        setTimeout(() => scheduleResumeImmediate(downloadId), 3000);
        throw new Error('PAUSE_FOR_RESUME');
      }
    }
    
    console.error(`❌ [VOD] Erro, abortando multipart...`);
    if (uploadId && parts.length === 0) {
      await abortMultipartUpload(r2Key, uploadId);
    }
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
      scheduleResumeImmediate(downloadId);
      return;
    }

    const seg = segments[i];
    let success = false;
    
    for (let retry = 0; retry < 3; retry++) {
      try {
        const res = await fetch(seg.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_CHUNK) });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.arrayBuffer();
        totalBytes += data.byteLength;
        
        await uploadToR2Simple(
          `vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`, 
          new Uint8Array(data), 
          'video/mp2t'
        );
        downloaded++;
        success = true;
        break;
      } catch (e) {
        if (retry === 2) console.error(`❌ Segment ${seg.index} failed after 3 retries`);
        await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
      }
    }

    if (i % 10 === 0) {
      await supabase.from('vod_downloads').update({ 
        segments_downloaded: downloaded, 
        file_size_bytes: totalBytes 
      }).eq('id', downloadId);
    }
  }

  // Gerar manifest atualizado
  const newManifestLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const seg = segments.find(s => s.line === trimmed);
      if (seg) {
        newManifestLines.push(`https://${r2Domain}/vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`);
      } else {
        newManifestLines.push(trimmed);
      }
    } else {
      newManifestLines.push(line);
    }
  }

  const newManifest = newManifestLines.join('\n');
  await uploadToR2Simple(`vod/${channel.id}/playlist.m3u8`, new TextEncoder().encode(newManifest), 'application/vnd.apple.mpegurl');
  
  console.log(`✅ [HLS] ${downloaded}/${segments.length} segmentos (${(totalBytes / 1048576).toFixed(1)}MB)`);
}

// Agendar retry imediato
function scheduleResumeImmediate(downloadId: string): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  if (!supabaseUrl || !cronSecret) return;

  setTimeout(async () => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/download-vod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': cronSecret,
        },
        body: JSON.stringify({ resume: true, downloadId }),
      });
      console.log(`📡 [VOD] Retry agendado para ${downloadId}`);
    } catch (e) {
      console.error(`❌ [VOD] Falha ao agendar retry:`, e);
    }
  }, 2000);
}
