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
  status: 'queued' | 'uploading' | 'processing' | 'ready' | 'error';
  progress_percent: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
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
  total_duration_hours: number;
  estimated_monthly_cost: number;
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
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as unknown as StreamUpload[]) || [];
  } catch (error: any) {
    console.error('[CloudflareStream] List uploads error:', error);
    return [];
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
 */
export function getOptimizedStreamUrl(channel: {
  cf_stream_url?: string | null;
  r2_url?: string | null;
  stream_url: string;
}): { url: string; source: 'cloudflare_stream' | 'r2' | 'original' } {
  if (channel.cf_stream_url) {
    return { url: channel.cf_stream_url, source: 'cloudflare_stream' };
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
  runScheduler,
  getOptimizedStreamUrl,
  subscribeToUploads,
};
