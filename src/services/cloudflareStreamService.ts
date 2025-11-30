/**
 * Cloudflare Stream Service
 * 
 * Gerencia uploads, playback e URLs assinadas de VODs via Cloudflare Stream
 */

import { supabase } from "@/integrations/supabase/client";

export interface StreamUpload {
  id: string;
  channel_id: string;
  original_url: string;
  cf_stream_uid: string | null;
  status: 'queued' | 'uploading' | 'processing' | 'ready' | 'error' | 'retry_scheduled' | 'downloading';
  progress_percent: number;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  metadata?: Record<string, unknown>;
}

export interface StreamStatistics {
  total_vods: number;
  vods_on_stream: number;
  vods_pending: number;
  uploads_queued: number;
  uploads_processing: number;
  uploads_ready: number;
  uploads_error: number;
  uploads_retry_scheduled: number;
  uploads_uploading: number;
  total_duration_hours: number;
  estimated_monthly_cost: number;
  avg_retry_count: number;
  success_rate: number;
  uploads_last_24h: number;
  errors_last_24h: number;
  max_retry_reached: number;
}

export interface PlaybackUrls {
  hls: string;
  dash: string;
  thumbnail: string;
  embed: string;
}

export interface SignedPlaybackUrl {
  url: string;
  signed: boolean;
  expiresAt?: number;
  expiresIn?: number;
}

export interface CriticalFailure {
  id: string;
  channel_id: string;
  channel_name: string;
  error_message: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Inicia upload de um VOD para o Cloudflare Stream
 */
export async function uploadToStream(channelId: string): Promise<{ success: boolean; cf_stream_uid?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-upload', {
      body: { action: 'upload', channel_id: channelId }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[CloudflareStream] Upload error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica o status de um upload no Stream
 */
export async function checkStreamStatus(cfStreamUid: string): Promise<{ status: string; isReady: boolean; progress?: number; duration?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-upload', {
      body: { action: 'check_status', cf_stream_uid: cfStreamUid }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[CloudflareStream] Status check error:', error);
    return { status: 'error', isReady: false };
  }
}

/**
 * Agenda um lote de uploads
 */
export async function scheduleBatchUpload(batchSize: number = 10): Promise<{ scheduled: number; results: any[] }> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-upload', {
      body: { action: 'schedule_batch', batch_size: batchSize }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[CloudflareStream] Batch schedule error:', error);
    return { scheduled: 0, results: [] };
  }
}

/**
 * Obtém URLs de playback para um vídeo
 */
export async function getPlaybackUrls(cfStreamUid: string): Promise<PlaybackUrls | null> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-upload', {
      body: { action: 'get_playback_url', cf_stream_uid: cfStreamUid }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[CloudflareStream] Playback URL error:', error);
    return null;
  }
}

/**
 * Obtém URL assinada para playback seguro de VOD
 */
export async function getSignedPlaybackUrl(
  cfStreamUid: string, 
  expiresInSeconds: number = 3600
): Promise<SignedPlaybackUrl | null> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-upload', {
      body: { 
        action: 'get_signed_url', 
        cf_stream_uid: cfStreamUid,
        expires_in_seconds: expiresInSeconds
      }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[CloudflareStream] Signed URL error:', error);
    return null;
  }
}

/**
 * Obtém estatísticas do Cloudflare Stream
 */
export async function getStreamStatistics(): Promise<StreamStatistics | null> {
  try {
    const { data, error } = await supabase.rpc('get_cf_stream_statistics');

    if (error) throw error;
    return data?.[0] || null;
  } catch (error: any) {
    console.error('[CloudflareStream] Statistics error:', error);
    return null;
  }
}

/**
 * Lista uploads recentes
 */
export async function getRecentUploads(limit: number = 50): Promise<StreamUpload[]> {
  try {
    const { data, error } = await supabase
      .from('cf_stream_uploads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as unknown as StreamUpload[]) || [];
  } catch (error: any) {
    console.error('[CloudflareStream] List uploads error:', error);
    return [];
  }
}

/**
 * Obtém falhas críticas (uploads que falharam múltiplas vezes)
 */
export async function getCriticalFailures(minRetries: number = 3): Promise<CriticalFailure[]> {
  try {
    const { data: uploads, error: uploadsError } = await supabase
      .from('cf_stream_uploads')
      .select('id, channel_id, error_message, retry_count, created_at, updated_at')
      .eq('status', 'error')
      .gte('retry_count', minRetries)
      .order('retry_count', { ascending: false })
      .limit(50);

    if (uploadsError) throw uploadsError;
    if (!uploads || uploads.length === 0) return [];

    // Get channel names
    const channelIds = [...new Set(uploads.map(u => u.channel_id))];
    const { data: channels } = await supabase
      .from('m3u_channels')
      .select('id, name')
      .in('id', channelIds);

    const channelMap = new Map(channels?.map(c => [c.id, c.name]) || []);

    return uploads.map(u => ({
      ...u,
      channel_name: channelMap.get(u.channel_id) || u.channel_id
    }));
  } catch (error: any) {
    console.error('[CloudflareStream] Critical failures error:', error);
    return [];
  }
}

/**
 * Reseta um upload com erro para retry
 */
export async function resetUploadForRetry(uploadId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cf_stream_uploads')
      .update({
        status: 'queued',
        retry_count: 0,
        error_message: null,
        cf_stream_uid: null,
        started_at: null
      })
      .eq('id', uploadId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('[CloudflareStream] Reset upload error:', error);
    return false;
  }
}

/**
 * Remove upload permanentemente
 */
export async function deleteUpload(uploadId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cf_stream_uploads')
      .delete()
      .eq('id', uploadId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('[CloudflareStream] Delete upload error:', error);
    return false;
  }
}

/**
 * Executa o scheduler manualmente
 */
export async function runScheduler(): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-scheduler', {});

    if (error) throw error;
    return { success: true, result: data };
  } catch (error: any) {
    console.error('[CloudflareStream] Scheduler error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém URL de stream otimizada (Stream > R2 > Original)
 * Inclui cf_stream_uid para integração com URLs assinadas
 */
export function getOptimizedStreamUrl(channel: {
  cf_stream_url?: string | null;
  cf_stream_uid?: string | null;
  r2_url?: string | null;
  stream_url: string;
}): { 
  url: string; 
  source: 'cloudflare_stream' | 'r2' | 'original';
  cfStreamUid?: string;
} {
  if (channel.cf_stream_url) {
    return { 
      url: channel.cf_stream_url, 
      source: 'cloudflare_stream',
      cfStreamUid: channel.cf_stream_uid || undefined
    };
  }
  if (channel.r2_url) {
    return { url: channel.r2_url, source: 'r2' };
  }
  return { url: channel.stream_url, source: 'original' };
}

/**
 * Subscribe to upload changes (realtime)
 */
export function subscribeToUploads(
  callback: (payload: { eventType: string; new?: StreamUpload; old?: { id: string } }) => void
) {
  return supabase
    .channel('cf-stream-uploads')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cf_stream_uploads'
      },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: payload.new as StreamUpload,
          old: payload.old as { id: string }
        });
      }
    )
    .subscribe();
}

export default {
  uploadToStream,
  checkStreamStatus,
  scheduleBatchUpload,
  getPlaybackUrls,
  getSignedPlaybackUrl,
  getStreamStatistics,
  getRecentUploads,
  getCriticalFailures,
  resetUploadForRetry,
  deleteUpload,
  runScheduler,
  getOptimizedStreamUrl,
  subscribeToUploads,
};
