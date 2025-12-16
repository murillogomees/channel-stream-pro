import { supabase } from '@/integrations/supabase/client';

export interface OriginServer {
  id: string;
  url: string;
  region: string;
  score: number;
}

export interface OriginSelectionResult {
  primary: OriginServer;
  fallbacks: OriginServer[];
  clientRegion: string;
  targetRegion: string;
}

export interface FailoverResult {
  success: boolean;
  newOrigin?: OriginServer;
  alternatives?: OriginServer[];
  error?: string;
  retry?: boolean;
}

export interface LLHLSConfig {
  targetLatency: number;
  partDuration: number;
  holdBackMultiplier: number;
  prefetchSegments: number;
  playlistWindow: number;
  canSkipUntil: number;
}

class StreamingOptimizationService {
  private currentOrigin: OriginServer | null = null;
  private failedOrigins: Set<string> = new Set();
  private llhlsConfig: LLHLSConfig = {
    targetLatency: 3.0,        // Target 3 seconds latency
    partDuration: 0.5,         // 500ms parts for low latency
    holdBackMultiplier: 2.0,   // Buffer 2x target latency
    prefetchSegments: 2,       // Prefetch 2 segments ahead
    playlistWindow: 30,        // 30 seconds playlist window
    canSkipUntil: 6.0          // Allow skipping up to 6 seconds
  };

  async selectOrigin(channelId?: number): Promise<OriginSelectionResult> {
    try {
      // Get client region from browser if available
      const clientRegion = await this.detectClientRegion();

      const { data, error } = await supabase.functions.invoke('origin-selector', {
        body: { channelId, preferredRegion: clientRegion }
      });

      if (error) throw error;

      this.currentOrigin = data.primary;
      return data;
    } catch (error) {
      console.error('[StreamingOptimization] Origin selection failed:', error);
      // Return default fallback
      return {
        primary: { id: 'fallback-global', url: 'https://origin.iptvlink.com.br', region: 'global', score: 50 },
        fallbacks: [],
        clientRegion: 'BR',
        targetRegion: 'global'
      };
    }
  }

  async requestFailover(channelId: number, errorCode: string, errorMessage?: string): Promise<FailoverResult> {
    if (!this.currentOrigin) {
      return { success: false, error: 'No current origin set', retry: true };
    }

    // Mark current origin as failed for this session
    this.failedOrigins.add(this.currentOrigin.id);

    try {
      const { data, error } = await supabase.functions.invoke('stream-failover', {
        body: {
          channelId,
          currentOriginId: this.currentOrigin.id,
          errorCode,
          errorMessage,
          clientRegion: await this.detectClientRegion()
        }
      });

      if (error) throw error;

      if (data.success && data.newOrigin) {
        this.currentOrigin = data.newOrigin;
      }

      return data;
    } catch (error) {
      console.error('[StreamingOptimization] Failover request failed:', error);
      return { success: false, error: error.message, retry: false };
    }
  }

  async getLLHLSConfig(channelId?: number): Promise<LLHLSConfig> {
    try {
      if (channelId) {
        // Check for channel-specific config
        const { data } = await supabase
          .from('iptv_llhls_config')
          .select('*')
          .eq('channel_id', channelId)
          .single();

        if (data) {
          return {
            targetLatency: data.target_latency || this.llhlsConfig.targetLatency,
            partDuration: data.part_duration || this.llhlsConfig.partDuration,
            holdBackMultiplier: data.hold_back_multiplier || this.llhlsConfig.holdBackMultiplier,
            prefetchSegments: data.prefetch_segments || this.llhlsConfig.prefetchSegments,
            playlistWindow: data.playlist_window || this.llhlsConfig.playlistWindow,
            canSkipUntil: data.can_skip_until || this.llhlsConfig.canSkipUntil
          };
        }
      }
    } catch (error) {
      console.warn('[StreamingOptimization] Failed to load LL-HLS config:', error);
    }

    return this.llhlsConfig;
  }

  getShakaLLHLSConfig(config: LLHLSConfig = this.llhlsConfig): object {
    return {
      streaming: {
        lowLatencyMode: true,
        inaccurateManifestTolerance: 0,
        rebufferingGoal: config.targetLatency,
        bufferingGoal: config.targetLatency * config.holdBackMultiplier,
        bufferBehind: config.playlistWindow,
        segmentPrefetchLimit: config.prefetchSegments,
        updateIntervalSeconds: config.partDuration,
        maxDisabledTime: 30,
        stallEnabled: true,
        stallThreshold: 1,
        stallSkip: config.canSkipUntil
      },
      manifest: {
        availabilityWindowOverride: config.playlistWindow,
        disableAudio: false,
        disableVideo: false,
        defaultPresentationDelay: config.targetLatency
      }
    };
  }

  getHlsJsLLHLSConfig(config: LLHLSConfig = this.llhlsConfig): object {
    return {
      lowLatencyMode: true,
      liveSyncDurationCount: Math.ceil(config.targetLatency / config.partDuration),
      liveMaxLatencyDurationCount: Math.ceil((config.targetLatency * 2) / config.partDuration),
      liveDurationInfinity: true,
      highBufferWatchdogPeriod: 1,
      maxBufferLength: config.targetLatency * config.holdBackMultiplier,
      maxMaxBufferLength: config.playlistWindow,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxBufferHole: 0.5,
      backBufferLength: config.playlistWindow,
      frontBufferFlushThreshold: config.targetLatency * 3
    };
  }

  buildStreamUrl(baseUrl: string, channelPath: string): string {
    const origin = this.currentOrigin?.url || baseUrl;
    return `${origin}${channelPath}`;
  }

  private async detectClientRegion(): Promise<string> {
    try {
      // Try to get from timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Simple mapping of common timezones to regions
      if (timezone.includes('America/Sao_Paulo') || timezone.includes('Brazil')) {
        return 'BR';
      }
      if (timezone.includes('America/New_York') || timezone.includes('America/Los_Angeles')) {
        return 'US';
      }
      if (timezone.includes('Europe/')) {
        return 'EU';
      }
      if (timezone.includes('Asia/')) {
        return 'AS';
      }
    } catch (error) {
      console.warn('[StreamingOptimization] Could not detect region:', error);
    }
    
    return 'BR'; // Default to BR
  }

  getCurrentOrigin(): OriginServer | null {
    return this.currentOrigin;
  }

  getFailedOrigins(): string[] {
    return Array.from(this.failedOrigins);
  }

  resetFailedOrigins(): void {
    this.failedOrigins.clear();
  }
}

export const streamingOptimizationService = new StreamingOptimizationService();
