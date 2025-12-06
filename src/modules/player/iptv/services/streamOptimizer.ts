/**
 * Stream Optimizer Service
 * 
 * Handles HTTP→HTTPS proxy, protocol detection, and performance optimization
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://sdvyxdghxqmntyoweqbd.supabase.co';

export type StreamProtocol = 'hls' | 'ts' | 'mp4' | 'dash' | 'unknown';
export type StreamSource = 'direct' | 'proxy' | 'r2' | 'cf-stream' | 'https-upgrade';

export interface OptimizedStream {
  url: string;
  protocol: StreamProtocol;
  source: StreamSource;
  requiresProxy: boolean;
  headers?: Record<string, string>;
  /** Fallback URL if primary fails (e.g., HTTPS upgrade fails, use proxy) */
  fallbackUrl?: string;
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
   * Extract original URL if wrapped in proxy
   */
  private extractOriginalUrl(url: string): string {
    // Check if URL is our proxy URL
    if (url.includes('/stream-proxy?') || url.includes('/stream-proxy%3F')) {
      try {
        const urlObj = new URL(url);
        const originalUrl = urlObj.searchParams.get('url');
        if (originalUrl) {
          return decodeURIComponent(originalUrl);
        }
      } catch {
        // Try regex fallback
        const match = url.match(/[?&]url=([^&]+)/);
        if (match) {
          try {
            return decodeURIComponent(match[1]);
          } catch {
            return url;
          }
        }
      }
    }
    return url;
  }

  /**
   * Detect stream protocol from URL
   * 
   * IMPORTANT: NO port-based heuristics!
   * Protocol is determined by extension or Content-Type only.
   * 
   * Xtream API patterns:
   * - /live/user/pass/id.ts - Live TS stream
   * - /movie/user/pass/id.mp4 - VOD MP4
   * - /series/user/pass/id.mp4 - Series VOD
   * - /user/pass/id - Unknown (requires Content-Type check)
   */
  detectProtocol(url: string): StreamProtocol {
    // Extract original URL if wrapped in proxy
    const actualUrl = this.extractOriginalUrl(url);
    const lowerUrl = actualUrl.toLowerCase();
    let pathname = '';
    try {
      pathname = new URL(actualUrl, 'http://dummy').pathname.toLowerCase();
    } catch {
      pathname = lowerUrl;
    }
    
    // Check for HLS first (highest priority)
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('.m3u') || pathname.endsWith('.m3u8')) {
      return 'hls';
    }
    
    // Check for explicit MP4/video files
    if (pathname.endsWith('.mp4') || pathname.endsWith('.mkv') || pathname.endsWith('.webm') || 
        pathname.endsWith('.avi') || pathname.endsWith('.mov')) {
      return 'mp4';
    }
    
    // Check for VOD/Movie content (MP4) - Xtream format with file extension
    // Only if URL has video extension in path
    if ((lowerUrl.includes('/movie/') || lowerUrl.includes('/series/') || lowerUrl.includes('/vod/')) &&
        (pathname.endsWith('.mp4') || pathname.endsWith('.mkv') || pathname.endsWith('.avi'))) {
      return 'mp4';
    }
    
    // Check for DASH
    if (lowerUrl.includes('.mpd') || pathname.endsWith('.mpd')) {
      return 'dash';
    }
    
    // Check for explicit TS streams (file extension only)
    if (pathname.endsWith('.ts')) {
      return 'ts';
    }

    // Check for live Xtream with .ts extension pattern
    if (lowerUrl.includes('/live/') && pathname.endsWith('.ts')) {
      return 'ts';
    }
    
    // IMPORTANT: We do NOT assume protocol based on port numbers
    // URLs without clear extension are 'unknown' and will use native playback
    // which handles most formats including HLS, MP4, etc.
    return 'unknown';
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
   * Check if content is VOD (large file that may timeout proxy)
   */
  isVodContent(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('/movie/') || 
           lowerUrl.includes('/series/') || 
           lowerUrl.includes('/vod/') ||
           (lowerUrl.endsWith('.mp4') && !lowerUrl.includes('/live/'));
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

    // HTTP content on HTTPS page - ALWAYS use proxy
    // IPTV servers typically don't support HTTPS, so https-upgrade fails with SSL errors
    if (needsProxy) {
      const proxyParams = new URLSearchParams({
        url: originalUrl,
        ...(config.authToken && { token: config.authToken }),
      });
      
      console.log('[StreamOptimizer] HTTP → Proxy:', protocol);
      return {
        url: `${this.proxyUrl}?${proxyParams}`,
        protocol,
        source: 'proxy',
        requiresProxy: true,
      };
    }

    // Default: direct URL (for HTTP page or other cases)
    return {
      url: originalUrl,
      protocol,
      source: 'direct',
      requiresProxy: false,
    };
  }

  /**
   * Get optimized HLS.js config based on stream type
   * Prioritizes smooth playback over low latency to prevent stuttering
   */
  getHlsConfig(lowLatency = false, isLive = true) {
    // STABILITY-FIRST config - larger buffers prevent stuttering
    const baseConfig = {
      enableWorker: !this.isSmartTV(),
      // LARGER buffers to prevent stuttering (was 8/15, now 30/60)
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxBufferHole: 0.5,
      // Start with auto quality for stability
      startLevel: -1, // Auto-select best starting level
      // Fragment loading
      startFragPrefetch: true,
      testBandwidth: true, // Enable bandwidth testing for better ABR
      // Reasonable loading timeouts
      fragLoadingTimeOut: 15000,
      manifestLoadingTimeOut: 10000,
      levelLoadingTimeOut: 10000,
      // Retry config - more retries for stability
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      fragLoadingRetryDelay: 1000,
      manifestLoadingRetryDelay: 1000,
      // Progressive loading
      progressive: true,
      // Back buffer for seeking
      backBufferLength: 30,
      // Live config - less aggressive for stability
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      liveDurationInfinity: isLive,
      // Disable low latency mode to prioritize stability
      lowLatencyMode: false,
      // ABR config - prefer stability over quick switches
      abrEwmaFastLive: 4,
      abrEwmaSlowLive: 12,
      abrEwmaFastVoD: 4,
      abrEwmaSlowVoD: 12,
      abrBandWidthFactor: 0.8, // Conservative bandwidth estimation
      abrBandWidthUpFactor: 0.6, // Slower quality upgrades
      // Nudge on stall for recovery
      nudgeMaxRetry: 5,
      nudgeOffset: 0.2,
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
      stashInitialSize: 384 * 1024, // 384KB initial buffer (was 128KB)
      isLive: true,
      lazyLoad: false,
      lazyLoadMaxDuration: 5 * 60,
      lazyLoadRecoverDuration: 60,
      deferLoadAfterSourceOpen: false,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 5 * 60,
      autoCleanupMinBackwardDuration: 3 * 60,
      fixAudioTimestampGap: true,
      accurateSeek: true,
      seekType: 'range' as const,
      rangeLoadZeroStart: false,
      // DISABLE latency chasing to prevent stuttering
      liveBufferLatencyChasing: false,
      liveBufferLatencyMaxLatency: 3.0, // Allow more latency
      liveBufferLatencyMinRemain: 1.0, // Keep more buffer
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
