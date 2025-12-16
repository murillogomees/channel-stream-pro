import { supabase } from '@/integrations/supabase/client';

export interface PredictedChannel {
  channelId: number;
  channelName: string;
  category: string;
  confidence: number;
  reason: 'frequently_watched' | 'time_pattern_match' | 'category_preference';
}

export interface PreloadStatus {
  channelId: number;
  status: 'pending' | 'loading' | 'ready' | 'failed';
  manifestUrl?: string;
  error?: string;
}

class PredictivePreloadService {
  private predictions: PredictedChannel[] = [];
  private preloadStatus: Map<number, PreloadStatus> = new Map();
  private preloadCache: Map<number, string> = new Map(); // channelId -> cached manifest
  private isPreloading = false;
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  async fetchPredictions(currentChannelId?: number): Promise<PredictedChannel[]> {
    if (!this.userId) {
      console.warn('[PredictivePreload] No userId set');
      return [];
    }

    try {
      const { data, error } = await supabase.functions.invoke('predictive-preload', {
        body: { userId: this.userId, currentChannelId, limit: 5 }
      });

      if (error) throw error;

      this.predictions = data.predictions || [];
      console.log(`[PredictivePreload] Fetched ${this.predictions.length} predictions`);
      
      return this.predictions;
    } catch (error) {
      console.error('[PredictivePreload] Failed to fetch predictions:', error);
      return [];
    }
  }

  async startPreloading(currentChannelId?: number): Promise<void> {
    if (this.isPreloading) return;

    this.isPreloading = true;

    try {
      // Get fresh predictions
      await this.fetchPredictions(currentChannelId);

      // Preload top 3 predicted channels
      const toPreload = this.predictions.slice(0, 3);

      for (const prediction of toPreload) {
        this.preloadStatus.set(prediction.channelId, {
          channelId: prediction.channelId,
          status: 'pending'
        });
      }

      // Preload in parallel with low priority
      await Promise.allSettled(
        toPreload.map(p => this.preloadChannel(p.channelId))
      );

    } finally {
      this.isPreloading = false;
    }
  }

  private async preloadChannel(channelId: number): Promise<void> {
    const status = this.preloadStatus.get(channelId);
    if (!status) return;

    status.status = 'loading';
    this.preloadStatus.set(channelId, status);

    try {
      // Get channel URL
      const { data: channel } = await supabase
        .from('iptv_channels')
        .select('original_url, transcode_manifest_url')
        .eq('id', channelId)
        .single();

      if (!channel) throw new Error('Channel not found');

      const manifestUrl = channel.transcode_manifest_url || channel.original_url;

      // Prefetch manifest with low priority
      const response = await fetch(manifestUrl, {
        method: 'HEAD',
        priority: 'low' as RequestPriority,
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        status.status = 'ready';
        status.manifestUrl = manifestUrl;
        this.preloadCache.set(channelId, manifestUrl);
        console.log(`[PredictivePreload] Preloaded channel ${channelId}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[PredictivePreload] Failed to preload channel ${channelId}:`, error);
    }

    this.preloadStatus.set(channelId, status);
  }

  getPreloadedUrl(channelId: number): string | null {
    return this.preloadCache.get(channelId) || null;
  }

  isChannelPreloaded(channelId: number): boolean {
    const status = this.preloadStatus.get(channelId);
    return status?.status === 'ready';
  }

  getPredictions(): PredictedChannel[] {
    return this.predictions;
  }

  getPreloadStatuses(): PreloadStatus[] {
    return Array.from(this.preloadStatus.values());
  }

  clearCache(): void {
    this.preloadCache.clear();
    this.preloadStatus.clear();
    this.predictions = [];
  }
}

export const predictivePreloadService = new PredictivePreloadService();
