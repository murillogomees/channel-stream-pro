/**
 * Mpegts.js Intelligent Loader
 * Only loads mpegts.js when actually needed for TS streams
 * 
 * Rules:
 * - ONLY load when protocol === 'ts' AND Content-Type is 'video/mp2t'
 * - NEVER use mpegts.js as default/catch-all
 * - Provide safe fallback when TS cannot be played
 */

import type { 
  MpegtsLoadDecision, 
  MpegtsConfig,
  ProtocolType,
  LogHandler 
} from './types';

// Default mpegts.js configuration optimized for live streaming
const DEFAULT_MPEGTS_CONFIG: MpegtsConfig = {
  enableWorker: true,
  lazyLoad: true,
  lazyLoadMaxDuration: 3 * 60,
  seekType: 'range',
  liveBufferLatencyChasing: true,
  liveBufferLatencyMaxLatency: 1.5,
  liveBufferLatencyMinRemain: 0.5,
};

// Content types that indicate actual TS content
const TS_CONTENT_TYPES = [
  'video/mp2t',
  'video/mpeg',
  'video/mpeg-ts',
  'video/mpegts',
];

export class MpegtsLoader {
  private logHandler?: LogHandler;
  private config: MpegtsConfig;
  private mpegtsModule: typeof import('mpegts.js') | null = null;
  private loadPromise: Promise<typeof import('mpegts.js')> | null = null;

  constructor(options?: {
    logHandler?: LogHandler;
    config?: Partial<MpegtsConfig>;
  }) {
    this.logHandler = options?.logHandler;
    this.config = { ...DEFAULT_MPEGTS_CONFIG, ...options?.config };
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    this.logHandler?.({
      level,
      module: 'MpegtsLoader',
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Determine if mpegts.js should be loaded for this stream
   */
  async shouldLoadMpegts(options: {
    url: string;
    protocol: ProtocolType;
    contentType?: string;
    verifyContentType?: boolean;
  }): Promise<MpegtsLoadDecision> {
    const { url, protocol, contentType, verifyContentType = true } = options;

    this.log('debug', 'Evaluating mpegts.js load decision', { url, protocol, contentType });

    // Rule 1: Protocol must be 'ts'
    if (protocol !== 'ts') {
      return {
        shouldLoad: false,
        reason: `Protocol is '${protocol}', not 'ts'. Mpegts.js not needed.`,
        protocol,
      };
    }

    // Rule 2: Verify Content-Type if requested
    let actualContentType = contentType;
    
    if (verifyContentType && !actualContentType) {
      actualContentType = await this.fetchContentType(url);
    }

    // Rule 3: Content-Type must indicate TS
    if (actualContentType) {
      const isTs = TS_CONTENT_TYPES.some(ct => 
        actualContentType!.toLowerCase().includes(ct)
      );

      if (!isTs) {
        return {
          shouldLoad: false,
          reason: `Content-Type '${actualContentType}' does not indicate TS stream.`,
          protocol,
          contentType: actualContentType,
        };
      }

      return {
        shouldLoad: true,
        reason: `TS stream confirmed via Content-Type: ${actualContentType}`,
        protocol,
        contentType: actualContentType,
      };
    }

    // Rule 4: If we can't verify and protocol is TS, load with caution
    // This is a fallback, not the default behavior
    return {
      shouldLoad: true,
      reason: 'Protocol is TS but Content-Type could not be verified. Loading with caution.',
      protocol,
    };
  }

  /**
   * Fetch Content-Type header from URL
   */
  private async fetchContentType(url: string): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.headers.get('content-type') || undefined;
    } catch (error) {
      this.log('warn', 'Failed to fetch Content-Type', { url, error: String(error) });
      return undefined;
    }
  }

  /**
   * Lazy load mpegts.js module
   */
  async loadMpegts(): Promise<typeof import('mpegts.js')> {
    if (this.mpegtsModule) {
      return this.mpegtsModule;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.log('info', 'Loading mpegts.js module');

    this.loadPromise = import('mpegts.js').then(module => {
      this.mpegtsModule = module;
      this.log('info', 'mpegts.js loaded successfully');
      return module;
    });

    return this.loadPromise;
  }

  /**
   * Check if mpegts.js is already loaded
   */
  isLoaded(): boolean {
    return this.mpegtsModule !== null;
  }

  /**
   * Check if mpegts.js is supported in current browser
   */
  isSupported(): boolean {
    if (this.mpegtsModule) {
      return this.mpegtsModule.default?.isSupported?.() ?? false;
    }
    // Check basic requirements without loading the module
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4');
  }

  /**
   * Create mpegts.js player instance
   */
  async createPlayer(options: {
    url: string;
    isLive?: boolean;
    config?: Partial<MpegtsConfig>;
  }): Promise<unknown> {
    const { url, isLive = true, config } = options;

    try {
      const mpegts = await this.loadMpegts();
      
      if (!mpegts.default?.isSupported?.()) {
        this.log('error', 'mpegts.js is not supported in this browser');
        return null;
      }

      const finalConfig = { ...this.config, ...config };

      this.log('info', 'Creating mpegts.js player', { url, isLive, config: finalConfig });

      const player = mpegts.default.createPlayer({
        type: 'mpegts',
        url,
        isLive,
      }, {
        enableWorker: finalConfig.enableWorker,
        lazyLoad: finalConfig.lazyLoad,
        lazyLoadMaxDuration: finalConfig.lazyLoadMaxDuration,
        seekType: finalConfig.seekType,
        liveBufferLatencyChasing: finalConfig.liveBufferLatencyChasing,
        liveBufferLatencyMaxLatency: finalConfig.liveBufferLatencyMaxLatency,
        liveBufferLatencyMinRemain: finalConfig.liveBufferLatencyMinRemain,
      });

      return player;
    } catch (error) {
      this.log('error', 'Failed to create mpegts.js player', { error: String(error) });
      return null;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): MpegtsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MpegtsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get fallback options when mpegts.js cannot be used
   */
  getFallbackOptions(url: string): { message: string; alternatives: string[] } {
    return {
      message: 'TS stream cannot be played with mpegts.js',
      alternatives: [
        'Try converting stream to HLS format',
        'Use stream-proxy to transcode on-the-fly',
        'Check if native browser playback is available',
      ],
    };
  }
}

// Singleton instance
let loaderInstance: MpegtsLoader | null = null;

export function getMpegtsLoader(options?: {
  logHandler?: LogHandler;
  config?: Partial<MpegtsConfig>;
}): MpegtsLoader {
  if (!loaderInstance) {
    loaderInstance = new MpegtsLoader(options);
  }
  return loaderInstance;
}

/**
 * Quick check if mpegts.js should be loaded
 */
export async function shouldUseMpegts(url: string, protocol: ProtocolType): Promise<boolean> {
  const decision = await getMpegtsLoader().shouldLoadMpegts({ url, protocol });
  return decision.shouldLoad;
}

/**
 * Create mpegts player if needed
 */
export async function createMpegtsPlayer(url: string, isLive: boolean = true) {
  return getMpegtsLoader().createPlayer({ url, isLive });
}
