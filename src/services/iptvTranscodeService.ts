/**
 * IPTV Transcode & Cache Service
 * Frontend service for managing IPTV transcoding and Redis cache operations
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_FUNCTIONS_URL } from '@/config/supabase';

// Types
export interface TranscodeJob {
  id: number;
  channel_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  mode: string;
  progress: number;
  target_resolutions: string[];
  output_urls: Record<string, string> | null;
  error_message: string | null;
  worker_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TranscodeStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface CacheStats {
  totalKeys: number;
  warmKeys: number;
  coldKeys: number;
  expiredKeys: number;
  memoryKeys: number;
  providers: string[];
  redisConfigured: boolean;
}

export interface ProbeResult {
  isHealthy: boolean;
  resolution?: string;
  bitrate?: number;
  codec?: string;
  error?: string;
}

class IPTVTranscodeService {
  private baseUrl = `${SUPABASE_FUNCTIONS_URL}`;

  private async invokeFunction<T>(
    functionName: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      console.error(`[${functionName}] Error:`, error);
      throw error;
    }

    return data as T;
  }

  // Transcode Operations
  async createTranscodeJob(
    channelId: number,
    options?: { mode?: 'hls' | 'dash'; resolutions?: string[] }
  ): Promise<{ success: boolean; job?: TranscodeJob }> {
    return this.invokeFunction('iptv-transcode', {
      action: 'create',
      channelId,
      mode: options?.mode || 'hls',
      resolutions: options?.resolutions || ['720p', '480p', '360p'],
    });
  }

  async cancelTranscodeJob(jobId: number): Promise<{ success: boolean }> {
    return this.invokeFunction('iptv-transcode', {
      action: 'cancel',
      jobId,
    });
  }

  async retryTranscodeJob(jobId: number): Promise<{ success: boolean }> {
    return this.invokeFunction('iptv-transcode', {
      action: 'retry',
      jobId,
    });
  }

  async getTranscodeJobStatus(jobId: number): Promise<{ job: TranscodeJob }> {
    return this.invokeFunction('iptv-transcode', {
      action: 'status',
      jobId,
    });
  }

  async listTranscodeJobs(): Promise<{ jobs: TranscodeJob[]; stats: TranscodeStats }> {
    return this.invokeFunction('iptv-transcode', {
      action: 'list',
    });
  }

  // Cache Operations
  async getCacheValue(key: string): Promise<{ value: unknown; source?: string; ttl?: number }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'get',
      key,
    });
  }

  async setCacheValue(
    key: string,
    value: unknown,
    ttl?: number
  ): Promise<{ success: boolean; ttl: number }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'set',
      key,
      value,
      ttl,
    });
  }

  async deleteCacheKey(key: string): Promise<{ success: boolean; deleted: number }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'delete',
      key,
    });
  }

  async deleteCachePattern(pattern: string): Promise<{ success: boolean; deleted: number }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'delete',
      pattern,
    });
  }

  async flushCache(): Promise<{ success: boolean; deleted: number }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'flush',
    });
  }

  async getCacheKeys(pattern?: string): Promise<{ keys: string[]; details: unknown[] }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'keys',
      pattern,
    });
  }

  async getCacheStats(): Promise<{ stats: CacheStats }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'stats',
    });
  }

  async warmupCache(
    channelIds: number[],
    ttl?: number
  ): Promise<{ success: boolean; warmed: number[] }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'warmup',
      channelIds,
      ttl,
    });
  }

  async getCacheTTL(key: string): Promise<{ ttl: number }> {
    return this.invokeFunction('iptv-redis-cache', {
      action: 'ttl',
      key,
    });
  }

  // Probe Operations
  async probeChannel(channelId: number): Promise<{ success: boolean; result: ProbeResult }> {
    return this.invokeFunction('iptv-probe', {
      action: 'probe',
      channelId,
    });
  }

  async batchProbeChannels(
    channelIds: number[]
  ): Promise<{ success: boolean; results: Array<{ channelId: number; healthy: boolean; error?: string }>; summary: { total: number; healthy: number; unhealthy: number } }> {
    return this.invokeFunction('iptv-probe', {
      action: 'batch-probe',
      channelIds,
    });
  }

  async listProbeJobs(): Promise<{ jobs: unknown[] }> {
    return this.invokeFunction('iptv-probe', {
      action: 'list',
    });
  }
}

export const iptvTranscodeService = new IPTVTranscodeService();