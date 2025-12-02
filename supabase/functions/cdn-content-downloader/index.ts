import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadJob {
  channelId: string;
  sourceUrl: string;
  contentType: 'live' | 'vod';
  credentials?: {
    username?: string;
    password?: string;
    headers?: Record<string, string>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { job }: { job: DownloadJob } = await req.json();

    console.log('[CDN Downloader] Starting download:', {
      channelId: job.channelId,
      url: job.sourceUrl,
      type: job.contentType
    });

    // Determinar estratégia baseado no tipo
    let downloadResult;
    if (job.contentType === 'live') {
      // Para LIVE: apenas validar e cachear manifest
      downloadResult = await downloadLiveManifest(job, supabase);
    } else {
      // Para VOD: download completo com retry robusto
      downloadResult = await downloadVODContent(job, supabase);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: downloadResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[CDN Downloader] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

/**
 * Download de manifests LIVE com retry robusto
 */
async function downloadLiveManifest(job: DownloadJob, supabase: any) {
  const maxRetries = 5;
  const baseDelay = 2000; // 2 segundos
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Live] Attempt ${attempt}/${maxRetries} for ${job.sourceUrl}`);
      
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*',
        'Connection': 'keep-alive',
      };

      // Adicionar credenciais se existirem
      if (job.credentials?.username && job.credentials?.password) {
        const auth = btoa(`${job.credentials.username}:${job.credentials.password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Adicionar headers customizados
      if (job.credentials?.headers) {
        Object.assign(headers, job.credentials.headers);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(job.sourceUrl, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifestContent = await response.text();
      
      // Salvar manifest no R2
      const r2Key = `live/${job.channelId}/playlist.m3u8`;
      await uploadToR2(r2Key, manifestContent, 'application/vnd.apple.mpegurl');

      // Atualizar registro no Supabase
      await supabase
        .from('r2_storage_objects')
        .upsert({
          key: r2Key,
          channel_id: job.channelId,
          content_type: 'live',
          size_bytes: new Blob([manifestContent]).size,
          status: 'ready',
          last_accessed_at: new Date().toISOString(),
        });

      console.log(`[Live] Success: ${r2Key}`);
      return { r2Key, size: manifestContent.length, attempts: attempt };

    } catch (error: any) {
      console.error(`[Live] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[Live] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
}

/**
 * Download de conteúdo VOD completo (HLS segments)
 */
async function downloadVODContent(job: DownloadJob, supabase: any) {
  console.log('[VOD] Starting full download...');
  
  // 1. Download manifest principal
  const manifestContent = await downloadWithRetry(job.sourceUrl, job.credentials);
  const manifestKey = `vod/${job.channelId}/master.m3u8`;
  await uploadToR2(manifestKey, manifestContent, 'application/vnd.apple.mpegurl');

  // 2. Parse manifest e extrair segmentos
  const segments = parseM3U8Segments(manifestContent, job.sourceUrl);
  console.log(`[VOD] Found ${segments.length} segments to download`);

  // 3. Download segmentos em lotes (máx 10 simultâneos)
  const batchSize = 10;
  let downloadedCount = 0;
  
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (segmentUrl) => {
        try {
          const segmentData = await downloadWithRetry(segmentUrl, job.credentials, 'arraybuffer');
          const segmentName = segmentUrl.split('/').pop() || `segment_${i}.ts`;
          const segmentKey = `vod/${job.channelId}/${segmentName}`;
          
          await uploadToR2(segmentKey, segmentData, 'video/mp2t');
          downloadedCount++;
          
          console.log(`[VOD] Downloaded ${downloadedCount}/${segments.length}: ${segmentName}`);
        } catch (error: any) {
          console.error(`[VOD] Failed to download segment ${segmentUrl}:`, error.message);
        }
      })
    );
  }

  // 4. Atualizar manifest com URLs do R2
  const updatedManifest = updateManifestUrls(manifestContent, job.channelId);
  await uploadToR2(manifestKey, updatedManifest, 'application/vnd.apple.mpegurl');

  // 5. Salvar metadata no Supabase
  await supabase
    .from('r2_storage_objects')
    .upsert({
      key: manifestKey,
      channel_id: job.channelId,
      content_type: 'vod',
      size_bytes: new Blob([updatedManifest]).size,
      status: 'ready',
      metadata: { totalSegments: segments.length, downloadedSegments: downloadedCount },
    });

  return { 
    manifestKey, 
    totalSegments: segments.length, 
    downloadedSegments: downloadedCount 
  };
}

/**
 * Download com retry robusto e exponential backoff
 */
async function downloadWithRetry(
  url: string, 
  credentials?: DownloadJob['credentials'],
  responseType: 'text' | 'arraybuffer' = 'text',
  maxRetries = 5
): Promise<any> {
  const baseDelay = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Range': 'bytes=0-', // Suporta partial content
      };

      if (credentials?.username && credentials?.password) {
        const auth = btoa(`${credentials.username}:${credentials.password}`);
        headers['Authorization'] = `Basic ${auth}`;
      }

      if (credentials?.headers) {
        Object.assign(headers, credentials.headers);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (responseType === 'arraybuffer') {
        return await response.arrayBuffer();
      } else {
        return await response.text();
      }

    } catch (error: any) {
      console.error(`[Download] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Upload para Cloudflare R2
 */
async function uploadToR2(key: string, content: any, contentType: string) {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
  const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
  const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const R2_BUCKET = 'iptvlink-cdn'; // Bucket fixo

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }

  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
  
  const body = typeof content === 'string' ? content : content;
  
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Authorization': `Bearer ${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.statusText}`);
  }

  console.log(`[R2] Uploaded: ${key}`);
}

/**
 * Parse M3U8 e extrair URLs de segmentos
 */
function parseM3U8Segments(content: string, baseUrl: string): string[] {
  const segments: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Se for URL absoluta, usar direto
    if (trimmed.startsWith('http')) {
      segments.push(trimmed);
    } else {
      // Resolver URL relativa
      const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
      segments.push(base + trimmed);
    }
  }
  
  return segments;
}

/**
 * Atualizar URLs do manifest para apontar para R2
 */
function updateManifestUrls(content: string, channelId: string): string {
  const lines = content.split('\n');
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Ignorar comentários e linhas vazias
    if (!trimmed || trimmed.startsWith('#')) return line;
    
    // Extrair nome do arquivo
    const filename = trimmed.split('/').pop() || trimmed;
    
    // Retornar URL do R2
    return `https://cdn.iptvlink.com/vod/${channelId}/${filename}`;
  });
  
  return updatedLines.join('\n');
}
