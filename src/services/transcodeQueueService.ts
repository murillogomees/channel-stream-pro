/**
 * ============================================================================
 * Transcode Queue Service
 * ============================================================================
 * 
 * Frontend service for managing the transcode job queue.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export type TranscodeJobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled';
export type QualityLadderPreset = 'basic' | 'standard' | 'premium' | 'ultra';

export interface TranscodeJob {
  id: string;
  channel_id: string;
  source_url: string;
  source_resolution: {
    width?: number;
    height?: number;
    fps?: number;
    bitrate?: number;
    codec?: string;
  } | null;
  status: TranscodeJobStatus;
  priority: number;
  ladder_preset: QualityLadderPreset;
  ladder_config: object | null;
  cf_stream_uid: string | null;
  cf_upload_id: string | null;
  output_manifests: {
    hls?: string;
    dash?: string;
    preview?: string;
  } | null;
  output_thumbnails: {
    default?: string;
    timestamp?: number;
  } | null;
  output_metadata: object | null;
  processor_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  retry_after: string | null;
  historical_views: number;
  estimated_popularity: number | null;
  created_at: string;
  updated_at: string;
}

export interface TranscodeJobHistory {
  id: string;
  job_id: string;
  old_status: TranscodeJobStatus | null;
  new_status: TranscodeJobStatus;
  changed_at: string;
  changed_by: string | null;
  metadata: object | null;
}

export interface QueueStats {
  queued: number;
  processing: number;
  ready: number;
  failed: number;
  total_today: number;
  avg_processing_time_ms: number | null;
  oldest_queued: string | null;
  active_processors: number;
}

export interface CreateJobParams {
  channelId: string;
  sourceUrl: string;
  sourceResolution?: {
    width?: number;
    height?: number;
    fps?: number;
  };
  ladderPreset?: QualityLadderPreset;
  priority?: number;
  historicalViews?: number;
}

// =============================================================================
// SERVICE
// =============================================================================

class TranscodeQueueService {
  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const { data, error } = await supabase.rpc('get_transcode_queue_stats');
    
    if (error) throw error;
    return data as unknown as QueueStats;
  }

  /**
   * List jobs with optional filters
   */
  async listJobs(params: {
    status?: TranscodeJobStatus;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'priority' | 'updated_at';
    orderDir?: 'asc' | 'desc';
  } = {}): Promise<{ jobs: TranscodeJob[]; count: number }> {
    const { status, limit = 50, offset = 0, orderBy = 'created_at', orderDir = 'desc' } = params;

    let query = supabase
      .from('transcode_jobs')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order(orderBy, { ascending: orderDir === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    
    if (error) throw error;
    return { jobs: data as TranscodeJob[], count: count || 0 };
  }

  /**
   * Get single job by ID
   */
  async getJob(jobId: string): Promise<TranscodeJob | null> {
    const { data, error } = await supabase
      .from('transcode_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as TranscodeJob | null;
  }

  /**
   * Get job history
   */
  async getJobHistory(jobId: string): Promise<TranscodeJobHistory[]> {
    const { data, error } = await supabase
      .from('transcode_job_history')
      .select('*')
      .eq('job_id', jobId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return data as TranscodeJobHistory[];
  }

  /**
   * Create a new transcode job
   */
  async createJob(params: CreateJobParams): Promise<TranscodeJob> {
    const { data, error } = await supabase
      .from('transcode_jobs')
      .insert({
        channel_id: params.channelId,
        source_url: params.sourceUrl,
        source_resolution: params.sourceResolution || null,
        ladder_preset: params.ladderPreset || 'standard',
        priority: params.priority || 0,
        historical_views: params.historicalViews || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data as TranscodeJob;
  }

  /**
   * Create multiple jobs from channel IDs
   */
  async createBulkJobs(channelIds: string[], options: {
    ladderPreset?: QualityLadderPreset;
    priority?: number;
  } = {}): Promise<{ created: number; skipped: number }> {
    // Get channels with stream URLs
    const { data: channels, error: channelsError } = await supabase
      .from('m3u_channels')
      .select('id, stream_url, is_vod')
      .in('id', channelIds)
      .eq('is_vod', true);

    if (channelsError) throw channelsError;

    const jobsToCreate = channels?.map(ch => ({
      channel_id: ch.id,
      source_url: ch.stream_url,
      ladder_preset: options.ladderPreset || 'standard',
      priority: options.priority || 0,
    })) || [];

    if (jobsToCreate.length === 0) {
      return { created: 0, skipped: channelIds.length };
    }

    const { error: insertError } = await supabase
      .from('transcode_jobs')
      .insert(jobsToCreate);

    if (insertError) throw insertError;

    return { 
      created: jobsToCreate.length, 
      skipped: channelIds.length - jobsToCreate.length,
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('update_transcode_job_status', {
      p_job_id: jobId,
      p_new_status: 'cancelled',
      p_changed_by: 'manual',
    });

    if (error) throw error;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('transcode_jobs')
      .update({
        status: 'queued',
        processor_id: null,
        error_message: null,
        error_code: null,
        retry_after: null,
      })
      .eq('id', jobId)
      .in('status', ['failed', 'cancelled']);

    if (error) throw error;
  }

  /**
   * Update job priority
   */
  async updatePriority(jobId: string, priority: number): Promise<void> {
    const { error } = await supabase
      .from('transcode_jobs')
      .update({ priority })
      .eq('id', jobId)
      .eq('status', 'queued');

    if (error) throw error;
  }

  /**
   * Trigger processor to consume jobs
   */
  async triggerProcessor(batchSize: number = 5): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const { data, error } = await supabase.functions.invoke('transcode-processor', {
      body: { batchSize },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Delete completed jobs older than X days
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('transcode_jobs')
      .delete()
      .in('status', ['ready', 'failed', 'cancelled'])
      .lt('completed_at', cutoffDate.toISOString())
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const transcodeQueueService = new TranscodeQueueService();
export default transcodeQueueService;
