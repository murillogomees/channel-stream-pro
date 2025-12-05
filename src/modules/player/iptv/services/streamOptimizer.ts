/**
 * Stream Optimizer Service
 * 
 * Handles HTTP→HTTPS proxy, protocol detection, and performance optimization
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://sdvyxdghxqmntyoweqbd.supabase.co';

export type StreamProtocol = 'hls' | 'ts' | 'mp4' | 'dash' | 'unknown';
export type StreamSource = 'direct' | 'proxy' | 'r2' | 'cf-stream';

export interface OptimizedStream {
  url: string;
  protocol: StreamProtocol;
  source: StreamSource;
  requiresProxy: boolean;
  headers?: Record<string, string>;
}

export interface StreamConfig {
  /** Force proxy even for HTTPS */
  forceProxy?: boolean;
  /** Preferred source type */
  preferredSource?: StreamSource;
  /** Auth token for signed URLs */
  authToken?: string;
  /** Channel ID for CDN lookup */
  channelId?: string;
}

class StreamOptimizerService {
  private proxyUrl: string;
  
  constructor() {
    this.proxyUrl = `${SUPABASE_URL}/functions/v1/stream-proxy`;
  }

  /**
   * Detect stream protocol from URL
   */
  detectProtocol(url: string): StreamProtocol {
    const lowerUrl = url.toLowerCase();
    let pathname = '';
    try {
      pathname = new URL(url, 'http://dummy').pathname.toLowerCase();
    } catch {
      pathname = lowerUrl;
    }
    
    // Check for HLS first
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('.m3u') || pathname.endsWith('.m3u8')) {
      return 'hls';
    }
    
    // Check for VOD/Movie content (MP4) - BEFORE checking for live/ts
    // Xtream format: /movie/user/pass/id.mp4 OR /movie/user/pass/id (no extension)
    if (lowerUrl.includes('/movie/') || lowerUrl.includes('/series/') || lowerUrl.includes('/vod/')) {
      return 'mp4';
    }
    
    // Check for explicit MP4 files
    if (pathname.endsWith('.mp4') || pathname.endsWith('.mkv') || pathname.endsWith('.webm')) {
      return 'mp4';
    }
    
    // Check for DASH
    if (lowerUrl.includes('.mpd')) {
      return 'dash';
    }
    
    // Check for TS/Live streams
    if (pathname.endsWith('.ts') || lowerUrl.includes('/live/') || lowerUrl.includes('stream.php')) {
      return 'ts';
    }
    
    // Default to TS for unknown IPTV streams (most live streams are TS)
    return 'ts';
  }

  /**
   * Check if URL requires proxy (HTTP on HTTPS page)
   */
  requiresProxy(url: string): boolean {
    if (typeof window === 'undefined') return false;
    
    const isHttpUrl = url.startsWith('http://');
    const isHttpsPage = window.location.protocol === 'https:';
    
    return isHttpUrl && isHttpsPage;
  }

  /**
   * Optimize stream URL for best performance
   */
  optimize(originalUrl: string, config: StreamConfig = {}): OptimizedStream {
    const protocol = this.detectProtocol(originalUrl);
    const needsProxy = config.forceProxy || this.requiresProxy(originalUrl);
    
    // Direct HTTPS - no proxy needed
    if (!needsProxy && originalUrl.startsWith('https://')) {
      return {
        url: originalUrl,
        protocol,
        source: 'direct',
        requiresProxy: false,
      };
    }

    // HTTP content - use proxy
    if (needsProxy) {
      const proxyParams = new URLSearchParams({
        url: originalUrl,
        ...(config.authToken && { token: config.authToken }),
      });
      
      return {
        url: `${this.proxyUrl}?${proxyParams}`,
        protocol,
        source: 'proxy',
        requiresProxy: true,
      };
    }

    // Default: direct URL
    return {
      url: originalUrl,
      protocol,
      source: 'direct',
      requiresProxy: false,
    };
  }

  /**
   * Get optimized HLS.js config based on stream type
   */
  getHlsConfig(lowLatency = true, isLive = true) {
    // Ultra-aggressive config for fastest startup
    const baseConfig = {
      enableWorker: !this.isSmartTV(),
      // Minimal buffer for instant start
      maxBufferLength: lowLatency ? 8 : 15,
      maxMaxBufferLength: lowLatency ? 15 : 30,
      maxBufferSize: 20 * 1000 * 1000, // 20MB
      maxBufferHole: 0.5,
      // Start with lowest quality for instant playback
      startLevel: 0,
      // Aggressive fragment loading
      startFragPrefetch: true,
      testBandwidth: false,
      // Faster loading timeouts
      fragLoadingTimeOut: 8000,
      manifestLoadingTimeOut: 5000,
      levelLoadingTimeOut: 8000,
      // Retry config
      fragLoadingMaxRetry: 3,
      manifestLoadingMaxRetry: 3,
      levelLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,
      manifestLoadingRetryDelay: 500,
      // Progressive loading
      progressive: true,
      // Minimal back buffer
      backBufferLength: lowLatency ? 5 : 15,
      // Live config
      liveSyncDurationCount: lowLatency ? 2 : 3,
      liveMaxLatencyDurationCount: lowLatency ? 5 : 8,
      liveDurationInfinity: isLive,
      // Low latency mode
      lowLatencyMode: lowLatency,
      // ABR config - prefer stability
      abrEwmaFastLive: 3,
      abrEwmaSlowLive: 9,
      abrEwmaFastVoD: 3,
      abrEwmaSlowVoD: 9,
      abrBandWidthFactor: 0.95,
      abrBandWidthUpFactor: 0.7,
    };

    return baseConfig;
  }

  /**
   * Get mpegts.js config for TS streams
   */
  getMpegtsConfig(): Record<string, any> {
    return {
      enableWorker: !this.isSmartTV(),
      enableStashBuffer: true,
      stashInitialSize: 128 * 1024, // 128KB initial buffer
      isLive: true,
      lazyLoad: false,
      lazyLoadMaxDuration: 3 * 60,
      lazyLoadRecoverDuration: 30,
      deferLoadAfterSourceOpen: false,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 3 * 60,
      autoCleanupMinBackwardDuration: 2 * 60,
      fixAudioTimestampGap: true,
      accurateSeek: true,
      seekType: 'range' as const,
      rangeLoadZeroStart: false,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 1.5,
      liveBufferLatencyMinRemain: 0.5,
    };
  }

  /**
   * Check if running on Smart TV
   */
  private isSmartTV(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('tizen') || ua.includes('webos') || ua.includes('hbbtv') || 
           ua.includes('smart-tv') || ua.includes('netcast') || ua.includes('viera') ||
           ua.includes('firetv') || ua.includes('roku');
  }

  /**
   * Preload stream manifest for instant start
   */
  async preload(url: string): Promise<boolean> {
    try {
      const optimized = this.optimize(url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      // Just fetch headers to warm connection
      await fetch(optimized.url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });
      
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Test stream availability
   */
  async testStream(url: string): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();
    try {
      const optimized = this.optimize(url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(optimized.url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      return {
        available: response.ok,
        latency: Date.now() - start,
      };
    } catch {
      return {
        available: false,
        latency: Date.now() - start,
      };
    }
  }
}

export const streamOptimizer = new StreamOptimizerService();
export { StreamOptimizerService };
