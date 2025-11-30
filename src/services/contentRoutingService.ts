/**
 * Content Routing Service
 * 
 * Serviço de roteamento inteligente de conteúdo para Stream vs R2
 * - Live TV / TV ao vivo → Stream (baixa latência)
 * - Séries / Filmes → R2 (economia de custos)
 * - Catálogo geral → Stream por padrão, R2 se alta demanda
 */

import { supabase } from '@/integrations/supabase/client';

export interface ContentRouting {
  destination: 'stream' | 'r2' | 'origin';
  reason: string;
  resolvedUrl: string;
  fallbackUrl: string;
  shouldDownload: boolean;
}

export interface RoutingStats {
  total_vods: number;
  in_r2: number;
  in_stream: number;
  origin_only: number;
  r2_jobs_queued: number;
  r2_jobs_processing: number;
  r2_jobs_completed: number;
  r2_jobs_failed: number;
  stream_jobs_queued: number;
  stream_jobs_processing: number;
  stream_jobs_ready: number;
  high_demand_channels: number;
  series_count: number;
  movies_count: number;
  live_count: number;
}

export interface R2DownloadJob {
  id: string;
  channel_id: string;
  status: string;
  original_url: string;
  r2_key?: string;
  r2_url?: string;
  progress_percent: number;
  downloaded_bytes?: number;
  total_bytes?: number;
  parts_uploaded: number;
  retry_count: number;
  error_message?: string;
  error_category?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ChannelDemand {
  channel_id: string;
  views_1h: number;
  views_24h: number;
  views_7d: number;
  views_30d: number;
  total_views: number;
  demand_score: number;
  trending_score: number;
}

export interface ContentCandidate {
  channel_id: string;
  channel_name: string;
  stream_url: string;
  group_title?: string;
  demand_score: number;
  views_24h: number;
  reason: string;
}

export interface RoutingConfig {
  config_key: string;
  config_value: Record<string, unknown>;
  description?: string;
}

// ========================================
// ROUTING FUNCTIONS
// ========================================

/**
 * Determina o destino de roteamento para um canal
 */
export async function getChannelRouting(channelId: string): Promise<ContentRouting | null> {
  try {
    const { data, error } = await supabase
      .rpc('determine_content_destination', { p_channel_id: channelId });

    if (error) throw error;
    
    const result = data?.[0];
    if (!result) return null;

    return {
      destination: result.destination as 'stream' | 'r2' | 'origin',
      reason: result.reason,
      resolvedUrl: result.resolved_url,
      fallbackUrl: result.fallback_url,
      shouldDownload: result.should_download,
    };
  } catch (error) {
    console.error('Error getting channel routing:', error);
    return null;
  }
}

/**
 * Obtém estatísticas do sistema de roteamento
 */
export async function getRoutingStats(): Promise<RoutingStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_content_routing_stats');

    if (error) throw error;
    
    const result = data?.[0];
    if (!result) return null;

    return result as unknown as RoutingStats;
  } catch (error) {
    console.error('Error getting routing stats:', error);
    return null;
  }
}

// ========================================
// R2 JOB MANAGEMENT
// ========================================

/**
 * Lista jobs de download R2
 */
export async function listR2Jobs(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: R2DownloadJob[]; count: number }> {
  try {
    let query = supabase
      .from('r2_download_jobs')
      .select('*', { count: 'exact' });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as R2DownloadJob[],
      count: count || 0,
    };
  } catch (error) {
    console.error('Error listing R2 jobs:', error);
    return { data: [], count: 0 };
  }
}

/**
 * Cria novo job de download R2
 */
export async function createR2Job(channelId: string, options?: {
  priority?: number;
}): Promise<R2DownloadJob | null> {
  try {
    // First get channel info
    const { data: channel, error: channelError } = await supabase
      .from('m3u_channels')
      .select('stream_url, name')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) throw channelError || new Error('Channel not found');

    const { data, error } = await supabase
      .from('r2_download_jobs')
      .insert({
        channel_id: channelId,
        original_url: channel.stream_url,
        status: 'queued',
        metadata: { priority: options?.priority || 100, channel_name: channel.name }
      })
      .select()
      .single();

    if (error) throw error;

    return data as R2DownloadJob;
  } catch (error) {
    console.error('Error creating R2 job:', error);
    return null;
  }
}

/**
 * Cancela job de download R2
 */
export async function cancelR2Job(jobId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('r2_download_jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId);

    return !error;
  } catch (error) {
    console.error('Error cancelling R2 job:', error);
    return false;
  }
}

/**
 * Retry job de download R2
 */
export async function retryR2Job(jobId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('r2_download_jobs')
      .update({ 
        status: 'queued',
        error_message: null,
        started_at: null,
        retry_count: 0,
      })
      .eq('id', jobId);

    return !error;
  } catch (error) {
    console.error('Error retrying R2 job:', error);
    return false;
  }
}

// ========================================
// CANDIDATE MANAGEMENT
// ========================================

/**
 * Obtém candidatos para download R2 (séries/filmes/alta demanda)
 */
export async function getR2Candidates(limit: number = 50): Promise<ContentCandidate[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_r2_download_candidates', { p_limit: limit });

    if (error) throw error;

    return (data || []).map((item: Record<string, unknown>) => ({
      channel_id: item.channel_id as string,
      channel_name: item.channel_name as string,
      stream_url: item.stream_url as string,
      group_title: item.group_title as string,
      demand_score: item.demand_score as number,
      views_24h: item.views_24h as number,
      reason: item.reason as string,
    }));
  } catch (error) {
    console.error('Error getting R2 candidates:', error);
    return [];
  }
}

/**
 * Obtém candidatos para upload Stream (live TV/catálogo)
 */
export async function getStreamCandidates(limit: number = 50): Promise<ContentCandidate[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_stream_upload_candidates', { p_limit: limit });

    if (error) throw error;

    return (data || []).map((item: Record<string, unknown>) => ({
      channel_id: item.channel_id as string,
      channel_name: item.channel_name as string,
      stream_url: item.stream_url as string,
      group_title: item.group_title as string,
      demand_score: item.demand_score as number,
      views_24h: item.views_24h as number,
      reason: item.reason as string,
    }));
  } catch (error) {
    console.error('Error getting Stream candidates:', error);
    return [];
  }
}

// ========================================
// DEMAND TRACKING
// ========================================

/**
 * Registra visualização de canal (para tracking de demanda)
 */
export async function trackChannelView(channelId: string, watchSeconds: number = 0): Promise<void> {
  try {
    await supabase.rpc('track_channel_view', { 
      p_channel_id: channelId, 
      p_watch_seconds: watchSeconds 
    });
  } catch (error) {
    console.error('Error tracking channel view:', error);
  }
}

/**
 * Obtém estatísticas de demanda de um canal
 */
export async function getChannelDemand(channelId: string): Promise<ChannelDemand | null> {
  try {
    const { data, error } = await supabase
      .from('channel_demand_stats')
      .select('*')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (error) throw error;

    return data as ChannelDemand | null;
  } catch (error) {
    console.error('Error getting channel demand:', error);
    return null;
  }
}

// ========================================
// CONFIGURATION
// ========================================

/**
 * Obtém configurações de roteamento
 */
export async function getRoutingConfig(): Promise<RoutingConfig[]> {
  try {
    const { data, error } = await supabase
      .from('content_routing_config')
      .select('*')
      .order('config_key');

    if (error) throw error;

    return (data || []) as RoutingConfig[];
  } catch (error) {
    console.error('Error getting routing config:', error);
    return [];
  }
}

/**
 * Atualiza configuração de roteamento
 */
export async function updateRoutingConfig(
  configKey: string, 
  configValue: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('content_routing_config')
      .update({ 
        config_value: configValue as unknown as Record<string, never>, 
        updated_at: new Date().toISOString() 
      })
      .eq('config_key', configKey);

    return !error;
  } catch (error) {
    console.error('Error updating routing config:', error);
    return false;
  }
}

// ========================================
// SCHEDULER TRIGGERS
// ========================================

/**
 * Dispara o scheduler R2 manualmente
 */
export async function triggerR2Scheduler(): Promise<{ success: boolean; result?: Record<string, unknown> }> {
  try {
    const { data, error } = await supabase.functions.invoke('r2-scheduler');

    if (error) throw error;

    return { success: true, result: data };
  } catch (error) {
    console.error('Error triggering R2 scheduler:', error);
    return { success: false };
  }
}

/**
 * Dispara o scheduler Stream manualmente
 */
export async function triggerStreamScheduler(): Promise<{ success: boolean; result?: Record<string, unknown> }> {
  try {
    const { data, error } = await supabase.functions.invoke('cf-stream-scheduler');

    if (error) throw error;

    return { success: true, result: data };
  } catch (error) {
    console.error('Error triggering Stream scheduler:', error);
    return { success: false };
  }
}

/**
 * Agenda múltiplos canais para download R2
 */
export async function scheduleR2Downloads(channelIds: string[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const channelId of channelIds) {
    const result = await createR2Job(channelId);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Agenda múltiplos canais para upload Stream
 */
export async function scheduleStreamUploads(channelIds: string[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const channelId of channelIds) {
    try {
      // Get channel info
      const { data: channel, error: channelError } = await supabase
        .from('m3u_channels')
        .select('stream_url, name')
        .eq('id', channelId)
        .single();

      if (channelError || !channel) {
        failed++;
        continue;
      }

      const { error } = await supabase
        .from('cf_stream_uploads')
        .insert({
          channel_id: channelId,
          original_url: channel.stream_url,
          status: 'queued',
          metadata: {} as Record<string, never>,
        });

      if (!error) {
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
