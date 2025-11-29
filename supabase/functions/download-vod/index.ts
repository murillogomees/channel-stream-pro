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

// Configuração de chunks para arquivos grandes
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB por chunk de download (menor = mais resiliente)
const R2_PART_SIZE = 5 * 1024 * 1024; // 5MB por parte de upload R2 (mínimo)
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB máximo
const EXECUTION_TIMEOUT = 40000; // 40 segundos por execução
const MAX_RETRIES = 3; // Máximo de tentativas por chunk
const RETRY_DELAY = 2000; // 2 segundos entre retries

// Função de retry com exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 206) {
        return response;
      }
      
      // Server error - retry
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        console.log(`⚠️ [Retry] Tentativa ${attempt + 1}/${retries + 1} falhou: ${response.status}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || 'Unknown error';
      
      // Erros que devem fazer retry
      const shouldRetry = errorMsg.includes('error reading a body') ||
                          errorMsg.includes('connection') ||
                          errorMsg.includes('aborted') ||
                          errorMsg.includes('timeout') ||
                          errorMsg.includes('network');
      
      if (!shouldRetry || attempt >= retries) {
        throw error;
      }
      
      const delay = RETRY_DELAY * Math.pow(2, attempt);
      console.log(`⚠️ [Retry] Tentativa ${attempt + 1}/${retries + 1}: ${errorMsg}. Aguardando ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

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
async function uploadToR2Simple(key: string, body: Uint8Array, contentType: string, cacheControl: string): Promise<void> {
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
    const { channelId, batch = false, channelIds = [], resume = false, downloadId } = body;

    // Modo resumo - continua download existente
    if (resume && downloadId) {
      console.log(`🔄 [VOD] Retomando download: ${downloadId}`);
      EdgeRuntime.waitUntil(resumeDownload(downloadId, supabaseService));
      return new Response(JSON.stringify({ success: true, message: 'Download retomado', downloadId }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Modo batch
    if (batch && channelIds.length > 0) {
      console.log(`🚀 [VOD] Batch de ${channelIds.length} downloads`);
      EdgeRuntime.waitUntil(processBatchDownloads(channelIds, supabaseService));
      return new Response(JSON.stringify({ success: true, message: `${channelIds.length} downloads iniciados`, channelIds }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download individual
    if (!channelId) {
      return new Response(JSON.stringify({ error: 'channelId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: channel, error: channelError } = await supabaseService.from('m3u_channels').select('*').eq('id', channelId).maybeSingle();
    if (channelError || !channel) throw new Error(`Canal não encontrado: ${channelError?.message}`);
    if (!channel.is_vod) throw new Error('Canal não é VOD');

    // Verificar se já foi enviado ao R2 (este canal)
    if (channel.r2_uploaded) {
      console.log(`⚠️ [VOD] Conteúdo já enviado ao R2: ${channel.name}`);
      
      // Corrigir URL se tiver https:// duplicado
      let fixedUrl = channel.r2_url;
      if (fixedUrl && fixedUrl.includes('https://https://')) {
        fixedUrl = fixedUrl.replace('https://https://', 'https://');
        await supabaseService.from('m3u_channels').update({ r2_url: fixedUrl }).eq('id', channelId);
        console.log(`🔧 [VOD] URL corrigida: ${fixedUrl}`);
      }
      
      return new Response(JSON.stringify({ 
        error: 'Conteúdo já enviado ao R2', 
        alreadyUploaded: true,
        r2Url: fixedUrl 
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // NOVO: Verificar se OUTRO canal com a mesma URL de origem já foi enviado ao R2
    const { data: sameUrlUploaded } = await supabaseService
      .from('m3u_channels')
      .select('id, name, r2_url')
      .eq('stream_url', channel.stream_url)
      .eq('r2_uploaded', true)
      .not('id', 'eq', channelId)
      .maybeSingle();

    if (sameUrlUploaded && sameUrlUploaded.r2_url) {
      console.log(`🔗 [VOD] Mesmo conteúdo já no R2 via ${sameUrlUploaded.name}, vinculando ${channel.name}`);
      
      // Vincular este canal ao mesmo arquivo R2
      await supabaseService
        .from('m3u_channels')
        .update({ 
          r2_uploaded: true, 
          r2_url: sameUrlUploaded.r2_url, 
          r2_uploaded_at: new Date().toISOString() 
        })
        .eq('id', channelId);
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Conteúdo vinculado ao R2 existente', 
        linkedTo: sameUrlUploaded.name,
        r2Url: sameUrlUploaded.r2_url 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar se já existe download ativo para este canal
    const { data: existingDownloads } = await supabaseService
      .from('vod_downloads')
      .select('id, status, created_at')
      .eq('channel_id', channelId)
      .in('status', ['queued', 'downloading', 'processing', 'paused'])
      .order('created_at', { ascending: false });

    if (existingDownloads && existingDownloads.length > 0) {
      if (existingDownloads.length > 1) {
        const duplicateIds = existingDownloads.slice(1).map(d => d.id);
        console.log(`🗑️ [VOD] Removendo ${duplicateIds.length} downloads duplicados para ${channel.name}`);
        await supabaseService.from('vod_downloads').delete().in('id', duplicateIds);
      }
      const activeDownload = existingDownloads[0];
      console.log(`⚠️ [VOD] Download já em andamento: ${channel.name} (${activeDownload.status})`);
      return new Response(JSON.stringify({ 
        error: 'Download já em andamento', 
        existingDownload: true,
        downloadId: activeDownload.id,
        status: activeDownload.status
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // NOVO: Verificar se já existe download ativo para a MESMA URL (outro canal)
    const { data: sameUrlDownloading } = await supabaseService
      .from('vod_downloads')
      .select('id, channel_id, status')
      .eq('original_url', channel.stream_url)
      .in('status', ['queued', 'downloading', 'processing', 'paused'])
      .not('channel_id', 'eq', channelId)
      .maybeSingle();

    if (sameUrlDownloading) {
      console.log(`⚠️ [VOD] Mesma URL já sendo baixada por outro canal: ${channel.stream_url}`);
      return new Response(JSON.stringify({ 
        error: 'Mesma URL já em download por outro canal', 
        existingDownload: true,
        downloadId: sameUrlDownloading.id,
        status: sameUrlDownloading.status
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar downloads "completed" recentes (últimas 24h)
    const { data: recentCompleted } = await supabaseService
      .from('vod_downloads')
      .select('id, r2_url')
      .eq('channel_id', channelId)
      .eq('status', 'completed')
      .not('r2_url', 'is', null)
      .gte('download_completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (recentCompleted) {
      console.log(`⚠️ [VOD] Download completado recentemente: ${channel.name}`);
      return new Response(JSON.stringify({ 
        error: 'VOD já foi baixado recentemente', 
        alreadyUploaded: true,
        r2Url: recentCompleted.r2_url 
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: downloadRecord, error: insertError } = await supabaseService.from('vod_downloads').insert({
      channel_id: channelId,
      original_url: channel.stream_url,
      status: 'queued',
      download_started_at: new Date().toISOString(),
      metadata: { chunk_size: CHUNK_SIZE, r2_part_size: R2_PART_SIZE }
    }).select().single();

    if (insertError || !downloadRecord?.id) {
      console.error(`❌ [VOD] Falha ao criar registro: ${insertError?.message}`);
      throw new Error(`Falha ao criar registro de download: ${insertError?.message || 'ID não retornado'}`);
    }

    console.log(`🎬 [VOD] Download enfileirado: ${channel.name} (ID: ${downloadRecord.id})`);
    EdgeRuntime.waitUntil(processVODDownload(channel, downloadRecord.id, supabaseService));

    return new Response(JSON.stringify({ success: true, message: 'Download iniciado', channelId, downloadId: downloadRecord.id }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('❌ [VOD] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processBatchDownloads(channelIds: string[], supabase: any): Promise<void> {
  const CONCURRENCY = 2;
  const queue = [...channelIds];
  const active: Promise<void>[] = [];
  const processedUrls = new Set<string>(); // Track URLs being processed in this batch

  while (queue.length > 0 || active.length > 0) {
    while (active.length < CONCURRENCY && queue.length > 0) {
      const channelId = queue.shift()!;
      const promise = (async () => {
        try {
          const { data: channel } = await supabase.from('m3u_channels').select('*').eq('id', channelId).maybeSingle();
          if (!channel?.is_vod) return;
          
          // Já enviado ao R2
          if (channel.r2_uploaded) {
            console.log(`⚠️ [Batch] ${channel.name} já no R2`);
            return;
          }

          // NOVO: Verificar se outro canal com mesma URL já foi enviado
          const { data: sameUrlUploaded } = await supabase
            .from('m3u_channels')
            .select('id, r2_url')
            .eq('stream_url', channel.stream_url)
            .eq('r2_uploaded', true)
            .neq('id', channelId)
            .maybeSingle();

          if (sameUrlUploaded?.r2_url) {
            console.log(`🔗 [Batch] Vinculando ${channel.name} ao R2 existente`);
            await supabase.from('m3u_channels').update({
              r2_uploaded: true,
              r2_url: sameUrlUploaded.r2_url,
              r2_uploaded_at: new Date().toISOString()
            }).eq('id', channelId);
            return;
          }

          // NOVO: Verificar se mesma URL já sendo processada neste batch
          if (processedUrls.has(channel.stream_url)) {
            console.log(`⚠️ [Batch] URL ${channel.stream_url} já em processamento neste batch`);
            return;
          }

          // NOVO: Verificar download ativo para mesma URL (outro canal)
          const { data: sameUrlDownload } = await supabase
            .from('vod_downloads')
            .select('id')
            .eq('original_url', channel.stream_url)
            .in('status', ['queued', 'downloading', 'processing', 'paused'])
            .maybeSingle();

          if (sameUrlDownload) {
            console.log(`⚠️ [Batch] Mesma URL já em download: ${channel.stream_url}`);
            return;
          }

          // Verificar se já existe download ativo para este canal
          const { data: existingDownloads } = await supabase
            .from('vod_downloads')
            .select('id, status, created_at')
            .eq('channel_id', channelId)
            .in('status', ['queued', 'downloading', 'processing', 'paused'])
            .order('created_at', { ascending: false });

          if (existingDownloads && existingDownloads.length > 0) {
            if (existingDownloads.length > 1) {
              const duplicateIds = existingDownloads.slice(1).map(d => d.id);
              await supabase.from('vod_downloads').delete().in('id', duplicateIds);
            }
            console.log(`⚠️ [Batch] Download já existe para ${channel.name}`);
            return;
          }

          // Marcar URL como em processamento
          processedUrls.add(channel.stream_url);

          const { data: downloadRecord, error: insertErr } = await supabase.from('vod_downloads').insert({
            channel_id: channelId,
            original_url: channel.stream_url,
            status: 'downloading',
            download_started_at: new Date().toISOString()
          }).select().single();
          
          if (insertErr || !downloadRecord?.id) {
            console.error(`❌ [Batch] Falha ao criar registro para ${channel.name}: ${insertErr?.message}`);
            processedUrls.delete(channel.stream_url);
            return;
          }
          
          await processVODDownload(channel, downloadRecord.id, supabase);
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

// Retomar download incompleto
async function resumeDownload(downloadId: string, supabase: any): Promise<void> {
  const { data: download, error } = await supabase
    .from('vod_downloads')
    .select('*, m3u_channels!inner(*)')
    .eq('id', downloadId)
    .single();

  if (error || !download) {
    console.error(`❌ [Resume] Download não encontrado: ${downloadId}`);
    return;
  }

  const channel = download.m3u_channels;
  const metadata = download.metadata || {};
  
  console.log(`🔄 [Resume] Retomando ${channel.name} - progresso: ${download.file_size_bytes || 0} bytes`);
  
  await processVODDownload(channel, downloadId, supabase, {
    resumeFrom: download.file_size_bytes || 0,
    uploadId: metadata.upload_id,
    existingParts: metadata.parts || []
  });
}

async function processVODDownload(
  channel: any, 
  downloadId: string, 
  supabase: any,
  resumeOptions?: { resumeFrom: number; uploadId?: string; existingParts?: any[] }
): Promise<void> {
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
    
    if (isHLS) {
      await downloadHLSVOD(channel, downloadId, supabase);
    } else {
      await downloadLargeFile(channel, downloadId, supabase, resumeOptions);
    }
    
    console.log(`✅ [VOD] Download concluído, finalizando...`);

    let r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN');
    if (!r2Domain) throw new Error('R2_PUBLIC_DOMAIN não configurado');
    
    // Remover protocolo se já existir para evitar duplicação
    r2Domain = r2Domain.replace(/^https?:\/\//, '');
    
    const urlPath = new URL(channel.stream_url).pathname;
    const ext = urlPath.split('.').pop() || 'mp4';
    const r2Url = isHLS 
      ? `https://${r2Domain}/vod/${channel.id}/playlist.m3u8` 
      : `https://${r2Domain}/vod/${channel.id}/video.${ext}`;

    // Atualizar canal
    const { error: channelError } = await supabase
      .from('m3u_channels')
      .update({ r2_uploaded: true, r2_url: r2Url, r2_uploaded_at: new Date().toISOString() })
      .eq('id', channel.id);
    
    if (channelError) console.error(`⚠️ [VOD] Erro ao atualizar canal: ${channelError.message}`);

    // NOVO: Atualizar OUTROS canais com a mesma stream_url para compartilhar o R2
    const { data: sameUrlChannels, error: sameUrlError } = await supabase
      .from('m3u_channels')
      .update({ r2_uploaded: true, r2_url: r2Url, r2_uploaded_at: new Date().toISOString() })
      .eq('stream_url', channel.stream_url)
      .eq('r2_uploaded', false)
      .neq('id', channel.id)
      .select('id');
    
    if (sameUrlChannels && sameUrlChannels.length > 0) {
      console.log(`🔗 [VOD] Vinculados ${sameUrlChannels.length} canais com mesma URL ao R2`);
      
      // Deletar downloads pendentes para esses canais (evitar downloads duplicados)
      const linkedIds = sameUrlChannels.map((c: any) => c.id);
      await supabase
        .from('vod_downloads')
        .delete()
        .in('channel_id', linkedIds)
        .in('status', ['queued', 'downloading', 'processing', 'paused', 'pending']);
    }
    
    // Marcar download como completo
    const { error: downloadError } = await supabase
      .from('vod_downloads')
      .update({ 
        status: 'completed', 
        r2_url: r2Url, 
        download_completed_at: new Date().toISOString(),
        error_message: null,
        metadata: null // Limpar metadata de progresso
      })
      .eq('id', downloadId);
    
    if (downloadError) {
      console.error(`❌ [VOD] Erro ao finalizar: ${downloadError.message}`);
      // Retry
      await supabase.from('vod_downloads')
        .update({ status: 'completed', r2_url: r2Url, download_completed_at: new Date().toISOString() })
        .eq('id', downloadId);
    }

    finalStatus = 'completed';
    console.log(`✅ [VOD] SUCESSO: ${channel.name} em ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    
  } catch (error: any) {
    finalError = error.message?.substring(0, 500) || 'Erro desconhecido';
    console.error(`❌ [VOD] Falha: ${channel.name} - ${finalError}`);
    
    // Verificar se é timeout e pode ser retomado
    if (finalError.includes('timeout') || finalError.includes('aborted')) {
      console.log(`⏸️ [VOD] Download pausado, pode ser retomado`);
      await supabase.from('vod_downloads')
        .update({ status: 'paused', error_message: 'Pode ser retomado' })
        .eq('id', downloadId);
      return;
    }
  } finally {
    if (finalStatus !== 'completed') {
      try {
        await supabase.from('vod_downloads')
          .update({ status: 'failed', error_message: finalError || 'Processo encerrado' })
          .eq('id', downloadId);
      } catch (e) {
        console.error(`❌ [VOD] Erro ao salvar falha:`, e);
      }
    }
  }
}

// Download otimizado para arquivos grandes com suporte a resume
async function downloadLargeFile(
  channel: any, 
  downloadId: string, 
  supabase: any,
  resumeOptions?: { resumeFrom: number; uploadId?: string; existingParts?: any[] }
): Promise<void> {
  console.log(`📥 [LargeFile] Iniciando download: ${channel.name}`);
  
  // Obter tamanho do arquivo
  let contentLength = 0;
  let supportsRanges = false;
  
  try {
    const headRes = await fetch(channel.stream_url, { method: 'HEAD' });
    if (headRes.ok) {
      contentLength = parseInt(headRes.headers.get('content-length') || '0');
      supportsRanges = headRes.headers.get('accept-ranges') === 'bytes';
      console.log(`📊 [LargeFile] Tamanho: ${(contentLength / 1048576).toFixed(1)} MB, Ranges: ${supportsRanges}`);
    }
  } catch (e) {
    console.log(`⚠️ [LargeFile] Não foi possível obter tamanho`);
  }

  // Verificar limite de tamanho
  if (contentLength > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande: ${(contentLength / 1073741824).toFixed(1)} GB (máximo: ${MAX_FILE_SIZE / 1073741824} GB)`);
  }

  const urlPath = new URL(channel.stream_url).pathname;
  const ext = urlPath.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : `video/${ext}`;

  // Para arquivos pequenos (< 50MB), usar upload simples com retry
  if (contentLength > 0 && contentLength < 50 * 1024 * 1024) {
    console.log(`📦 [LargeFile] Arquivo pequeno, usando upload simples`);
    const response = await fetchWithRetry(channel.stream_url);
    if (!response.ok) throw new Error(`Download falhou: ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    await uploadToR2Simple(r2Key, data, contentType, 'public, max-age=31536000, immutable');
    await supabase.from('vod_downloads').update({ file_size_bytes: data.length }).eq('id', downloadId);
    return;
  }

  // Para arquivos grandes, usar multipart com streaming
  const startByte = resumeOptions?.resumeFrom || 0;
  let uploadId = resumeOptions?.uploadId;
  let parts: { partNumber: number; etag: string }[] = resumeOptions?.existingParts || [];
  let partNumber = parts.length + 1;
  let totalBytes = startByte;

  // Iniciar multipart se não existir
  if (!uploadId) {
    uploadId = await initiateMultipartUpload(r2Key, contentType);
    console.log(`🔑 [LargeFile] Upload ID: ${uploadId.substring(0, 16)}...`);
  }

  try {
    // Salvar estado inicial
    await supabase.from('vod_downloads').update({
      file_size_bytes: contentLength || 0,
      metadata: { upload_id: uploadId, parts, start_byte: startByte }
    }).eq('id', downloadId);

    const startExecution = Date.now();

    // Se suporta ranges, baixar em chunks
    if (supportsRanges && contentLength > 0) {
      let currentByte = startByte;
      
      while (currentByte < contentLength) {
        // Verificar timeout de execução
        if (Date.now() - startExecution > EXECUTION_TIMEOUT) {
          console.log(`⏸️ [LargeFile] Timeout de execução, salvando progresso...`);
          await supabase.from('vod_downloads').update({
            status: 'paused',
            file_size_bytes: totalBytes,
            metadata: { upload_id: uploadId, parts, resume_byte: currentByte }
          }).eq('id', downloadId);
          
          // Agendar retomada
          scheduleResume(downloadId, supabase);
          return;
        }

        const endByte = Math.min(currentByte + CHUNK_SIZE - 1, contentLength - 1);
        
        console.log(`📥 [LargeFile] Chunk ${currentByte}-${endByte} (${((endByte - currentByte + 1) / 1048576).toFixed(1)} MB)`);
        
        const response = await fetchWithRetry(channel.stream_url, {
          headers: { 'Range': `bytes=${currentByte}-${endByte}` }
        });
        
        if (!response.ok && response.status !== 206) {
          throw new Error(`Range request falhou: ${response.status}`);
        }
        
        const chunkData = new Uint8Array(await response.arrayBuffer());
        
        // Upload do chunk para R2 em partes menores
        for (let offset = 0; offset < chunkData.length; offset += R2_PART_SIZE) {
          const partData = chunkData.slice(offset, Math.min(offset + R2_PART_SIZE, chunkData.length));
          
          // Última parte pode ser menor que 5MB
          if (partData.length < 5 * 1024 * 1024 && currentByte + chunkData.length < contentLength) {
            // Guardar para juntar com próximo chunk
            continue;
          }
          
          console.log(`⬆️ [LargeFile] Parte ${partNumber} (${(partData.length / 1048576).toFixed(1)} MB)`);
          const etag = await uploadPart(r2Key, uploadId, partNumber, partData);
          parts.push({ partNumber, etag });
          partNumber++;
        }
        
        totalBytes += chunkData.length;
        currentByte = endByte + 1;
        
        // Atualizar progresso
        const progress = Math.round((totalBytes / contentLength) * 100);
        await supabase.from('vod_downloads').update({
          file_size_bytes: totalBytes,
          segments_downloaded: parts.length,
          metadata: { upload_id: uploadId, parts, resume_byte: currentByte }
        }).eq('id', downloadId);
        
        console.log(`📈 [LargeFile] ${progress}% (${(totalBytes / 1048576).toFixed(1)} MB)`);
      }
    } else {
      // Streaming sem ranges
      await downloadStreamingMode(channel, downloadId, supabase, uploadId, parts, partNumber, contentLength);
      return;
    }

    // Completar multipart
    console.log(`⬆️ [LargeFile] Finalizando com ${parts.length} partes...`);
    parts.sort((a, b) => a.partNumber - b.partNumber);
    await completeMultipartUpload(r2Key, uploadId, parts);
    
    console.log(`✅ [LargeFile] Upload completo: ${(totalBytes / 1048576).toFixed(1)} MB`);

  } catch (error) {
    console.error(`❌ [LargeFile] Erro, abortando...`);
    if (uploadId) await abortMultipartUpload(r2Key, uploadId);
    throw error;
  }
}

// Streaming para quando não há suporte a ranges - com reconexão
async function downloadStreamingMode(
  channel: any, 
  downloadId: string, 
  supabase: any,
  uploadId: string,
  existingParts: { partNumber: number; etag: string }[],
  startPartNumber: number,
  knownSize: number,
  maxRetries: number = 3
): Promise<void> {
  console.log(`📥 [Streaming] Download sem ranges (max ${maxRetries} tentativas)...`);
  
  const urlPath = new URL(channel.stream_url).pathname;
  const ext = urlPath.split('.').pop() || 'mp4';
  const r2Key = `vod/${channel.id}/video.${ext}`;
  
  let attemptCount = 0;
  let lastError: Error | null = null;
  
  while (attemptCount < maxRetries) {
    attemptCount++;
    console.log(`🔄 [Streaming] Tentativa ${attemptCount}/${maxRetries}`);
    
    // Cada tentativa começa do zero (streaming sem ranges não pode continuar)
    // Mas mantemos o uploadId para não perder partes já enviadas
    let parts: { partNumber: number; etag: string }[] = [];
    let partNumber = 1;
    let totalBytes = 0;
    let buffer = new Uint8Array(R2_PART_SIZE);
    let bufferSize = 0;
    let lastUpdate = Date.now();
    const startExecution = Date.now();
    
    // Para cada nova tentativa, precisamos de um novo uploadId se o anterior foi abortado
    let currentUploadId = uploadId;
    if (attemptCount > 1) {
      // Abortar upload anterior e começar novo
      try {
        await abortMultipartUpload(r2Key, currentUploadId);
      } catch (e) {
        // Ignorar erro ao abortar
      }
      currentUploadId = await initiateMultipartUpload(r2Key, 'video/mp4');
      console.log(`📤 [Streaming] Novo upload ID: ${currentUploadId.substring(0, 20)}...`);
      
      // Atualizar metadata com novo uploadId
      await supabase.from('vod_downloads').update({
        metadata: { upload_id: currentUploadId, parts: [], start_byte: 0 }
      }).eq('id', downloadId);
    }
    
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    
    try {
      // Nova conexão para cada tentativa
      const response = await fetchWithRetry(channel.stream_url);
      
      if (!response.ok) throw new Error(`Download falhou: ${response.status}`);
      
      reader = response.body?.getReader() || null;
      if (!reader) throw new Error('Não foi possível criar reader');
      
      let readComplete = false;
      
      while (!readComplete) {
        // Verificar timeout de execução
        if (Date.now() - startExecution > EXECUTION_TIMEOUT) {
          console.log(`⏸️ [Streaming] Timeout, salvando progresso...`);
          await supabase.from('vod_downloads').update({
            status: 'paused',
            file_size_bytes: totalBytes,
            metadata: { upload_id: currentUploadId, parts, needs_restart: true }
          }).eq('id', downloadId);
          scheduleResume(downloadId, supabase);
          reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        
        if (done) {
          readComplete = true;
          break;
        }
        
        // Processar dados
        let offset = 0;
        while (offset < value.length) {
          const remaining = R2_PART_SIZE - bufferSize;
          const toCopy = Math.min(remaining, value.length - offset);
          
          buffer.set(value.slice(offset, offset + toCopy), bufferSize);
          bufferSize += toCopy;
          offset += toCopy;
          totalBytes += toCopy;
          
          // Buffer cheio - upload
          if (bufferSize >= R2_PART_SIZE) {
            const etag = await uploadPart(r2Key, currentUploadId, partNumber, buffer);
            parts.push({ partNumber, etag });
            partNumber++;
            buffer = new Uint8Array(R2_PART_SIZE);
            bufferSize = 0;
          }
        }
        
        // Atualizar progresso a cada 5s
        if (Date.now() - lastUpdate > 5000) {
          lastUpdate = Date.now();
          const progress = knownSize > 0 ? Math.round((totalBytes / knownSize) * 100) : 0;
          await supabase.from('vod_downloads').update({
            file_size_bytes: totalBytes,
            segments_downloaded: parts.length,
            metadata: { upload_id: currentUploadId, parts }
          }).eq('id', downloadId);
          console.log(`📈 [Streaming] ${(totalBytes / 1048576).toFixed(1)} MB${knownSize > 0 ? ` (${progress}%)` : ''}`);
        }
      }
      
      // Stream completo - finalizar
      if (bufferSize > 0) {
        const etag = await uploadPart(r2Key, currentUploadId, partNumber, buffer.slice(0, bufferSize));
        parts.push({ partNumber, etag });
      }
      
      // Completar multipart
      console.log(`⬆️ [Streaming] Finalizando com ${parts.length} partes...`);
      parts.sort((a, b) => a.partNumber - b.partNumber);
      await completeMultipartUpload(r2Key, currentUploadId, parts);
      
      await supabase.from('vod_downloads').update({
        file_size_bytes: totalBytes,
        segment_count: parts.length,
        segments_downloaded: parts.length
      }).eq('id', downloadId);
      
      console.log(`✅ [Streaming] ${(totalBytes / 1048576).toFixed(1)} MB em ${parts.length} partes`);
      return; // Sucesso!
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ [Streaming] Erro na tentativa ${attemptCount}:`, error.message);
      
      // Fechar reader se existir
      if (reader) {
        try { reader.cancel(); } catch (e) {}
      }
      
      // Se ainda temos tentativas, aguardar antes de tentar novamente
      if (attemptCount < maxRetries) {
        const delay = 2000 * attemptCount; // Exponential backoff
        console.log(`⏳ [Streaming] Aguardando ${delay}ms antes de reconectar...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  // Todas as tentativas falharam
  console.error(`❌ [Streaming] Todas as ${maxRetries} tentativas falharam`);
  throw lastError || new Error(`Download falhou após ${maxRetries} tentativas`);
}

// HLS download (mantido similar)
async function downloadHLSVOD(channel: any, downloadId: string, supabase: any): Promise<void> {
  const r2Domain = Deno.env.get('R2_PUBLIC_DOMAIN')!;
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
      segments.push({ index: segmentIndex++, url: trimmed.startsWith('http') ? trimmed : baseUrl + trimmed, line: trimmed });
    }
  }

  console.log(`📊 [HLS] ${segments.length} segmentos`);
  await supabase.from('vod_downloads').update({ segment_count: segments.length, segments_downloaded: 0 }).eq('id', downloadId);

  let totalBytes = 0, downloaded = 0;
  const PARALLEL = 5;
  let lastUpdate = Date.now();

  for (let i = 0; i < segments.length; i += PARALLEL) {
    const batch = segments.slice(i, i + PARALLEL);
    await Promise.all(batch.map(async (seg) => {
      for (let retry = 0; retry < 3; retry++) {
        try {
          const res = await fetch(seg.url, { signal: AbortSignal.timeout(60000) });
          if (!res.ok) throw new Error(`${res.status}`);
          const data = await res.arrayBuffer();
          totalBytes += data.byteLength;
          await uploadToR2Simple(
            `vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`, 
            new Uint8Array(data), 
            'video/mp2t', 
            'public, max-age=31536000, immutable'
          );
          downloaded++;
          break;
        } catch (e) {
          if (retry === 2) console.error(`❌ Segment ${seg.index} failed`);
        }
      }
    }));

    if (Date.now() - lastUpdate > 2000) {
      lastUpdate = Date.now();
      await supabase.from('vod_downloads').update({ segments_downloaded: downloaded, file_size_bytes: totalBytes }).eq('id', downloadId);
      console.log(`📈 [HLS] ${Math.round((downloaded / segments.length) * 100)}%`);
    }
  }

  // Reescrever manifest
  let newManifest = manifestContent;
  const cleanDomain = r2Domain.replace(/^https?:\/\//, '');
  for (const seg of segments) {
    newManifest = newManifest.replace(seg.line, `https://${cleanDomain}/vod/${channel.id}/segment_${seg.index.toString().padStart(6, '0')}.ts`);
  }
  await uploadToR2Simple(`vod/${channel.id}/playlist.m3u8`, new TextEncoder().encode(newManifest), 'application/vnd.apple.mpegurl', 'public, max-age=3600');
  
  console.log(`✅ [HLS] ${downloaded}/${segments.length} segmentos, ${(totalBytes / 1048576).toFixed(1)} MB`);
}

// Agendar retomada do download
function scheduleResume(downloadId: string, _supabase: any): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  // Chamar a própria função com delay
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
      console.error(`❌ [Schedule] Falha ao agendar retomada:`, e);
    }
  }, 2000);
}
