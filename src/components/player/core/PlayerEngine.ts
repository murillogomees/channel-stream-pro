/**
 * PlayerEngine - Core HLS Engine abstraction
 * 
 * REGRA ABSOLUTA: Aceita SOMENTE .m3u8 como source
 * O carregamento de segmentos .ts é 100% gerenciado pelo HLS.js
 * 
 * @architecture
 * - Classe central reutilizável entre plataformas
 * - Gestão de erros (403, timeout, network)
 * - Retry inteligente com backoff
 * - Headers propagation automática
 */

import Hls, { HlsConfig, ErrorData, Events } from 'hls.js';

export interface PlayerEngineConfig {
  /** Enable low latency mode for live streams */
  lowLatency?: boolean;
  /** Max buffer length in seconds */
  maxBufferLength?: number;
  /** Max retries for manifest loading */
  maxManifestRetries?: number;
  /** Max retries for fragment loading */
  maxFragmentRetries?: number;
  /** Custom headers to propagate */
  headers?: Record<string, string>;
  /** Stream origin for Referer header */
  streamOrigin?: string;
}

export interface PlayerEngineCallbacks {
  onReady?: () => void;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (error: PlayerError) => void;
  onRecovering?: (attempt: number, maxAttempts: number) => void;
  onQualityChange?: (level: number, maxLevel: number) => void;
  onStats?: (stats: PlayerStats) => void;
}

export interface PlayerError {
  type: 'network' | 'media' | 'fatal' | 'auth';
  code?: number;
  message: string;
  recoverable: boolean;
}

export interface PlayerStats {
  bitrate: number;
  buffered: number;
  droppedFrames: number;
  latency: number;
}

const DEFAULT_CONFIG: PlayerEngineConfig = {
  lowLatency: false,
  maxBufferLength: 30,
  maxManifestRetries: 3,
  maxFragmentRetries: 2,
};

/**
 * PlayerEngine - HLS Engine wrapper
 * Gerencia todo o ciclo de vida do player HLS
 */
export class PlayerEngine {
  private hls: Hls | null = null;
  private video: HTMLVideoElement | null = null;
  private config: PlayerEngineConfig;
  private callbacks: PlayerEngineCallbacks;
  private currentUrl: string | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private isDestroyed = false;
  private lastErrorUrl: string | null = null;

  constructor(config: PlayerEngineConfig = {}, callbacks: PlayerEngineCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  /**
   * Check if HLS.js is supported
   */
  static isSupported(): boolean {
    return Hls.isSupported();
  }

  /**
   * Check if URL is HLS format
   */
  static isHlsUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('.m3u8') || lower.includes('.m3u');
  }

  /**
   * Attach video element and load source
   * REGRA: Aceita SOMENTE .m3u8
   */
  attach(video: HTMLVideoElement, url: string): boolean {
    if (this.isDestroyed) {
      console.error('[PlayerEngine] Cannot attach - engine destroyed');
      return false;
    }

    if (!PlayerEngine.isHlsUrl(url)) {
      console.error('[PlayerEngine] REGRA VIOLADA: URL deve ser .m3u8');
      this.callbacks.onError?.({
        type: 'fatal',
        message: 'Formato de stream inválido. Apenas .m3u8 é suportado.',
        recoverable: false,
      });
      return false;
    }

    this.video = video;
    this.currentUrl = url;
    this.retryCount = 0;

    // Cleanup existing instance
    this.destroyHls();

    // Check native HLS support (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      return this.attachNative(video, url);
    }

    // Use HLS.js
    if (Hls.isSupported()) {
      return this.attachHlsJs(video, url);
    }

    this.callbacks.onError?.({
      type: 'fatal',
      message: 'HLS não suportado neste navegador',
      recoverable: false,
    });
    return false;
  }

  /**
   * Attach using HLS.js
   */
  private attachHlsJs(video: HTMLVideoElement, url: string): boolean {
    const hlsConfig: Partial<HlsConfig> = {
      // Buffer settings
      maxBufferLength: this.config.maxBufferLength || 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 30 * 1000 * 1000,
      
      // Live sync for low latency
      liveSyncDurationCount: this.config.lowLatency ? 2 : 3,
      liveMaxLatencyDurationCount: this.config.lowLatency ? 4 : 6,
      
      // Performance
      enableWorker: true,
      lowLatencyMode: this.config.lowLatency || false,
      startLevel: -1, // Auto quality selection
      
      // CRITICAL: Disable aggressive prefetch
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      
      // Fragment loading
      fragLoadingMaxRetry: this.config.maxFragmentRetries || 2,
      fragLoadingRetryDelay: 1000,
      fragLoadingMaxRetryTimeout: 8000,
      
      // Manifest loading
      manifestLoadingMaxRetry: this.config.maxManifestRetries || 3,
      manifestLoadingRetryDelay: 1000,
      manifestLoadingTimeOut: 15000,
      
      // Level loading
      levelLoadingMaxRetry: 2,
      levelLoadingRetryDelay: 1000,

      /**
       * CRITICAL: xhrSetup for header propagation
       * Garante que TODAS as requisições (.m3u8 + .ts) tenham headers corretos
       */
      xhrSetup: (xhr: XMLHttpRequest, xhrUrl: string) => {
        // Accept all content types
        xhr.setRequestHeader('Accept', '*/*');
        
        // Propagate custom headers
        if (this.config.headers) {
          Object.entries(this.config.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        // Debug segment fetches
        if (xhrUrl.includes('.ts')) {
          console.debug('[PlayerEngine] Fetching segment');
        }
      },
    };

    const hls = new Hls(hlsConfig);
    this.hls = hls;

    // Event: Manifest parsed - ready to play
    hls.on(Events.MANIFEST_PARSED, (_, data) => {
      console.log('[PlayerEngine] Manifest parsed, levels:', data.levels.length);
      this.retryCount = 0;
      this.lastErrorUrl = null;
      this.callbacks.onReady?.();
      
      // Auto-play
      video.play().catch((e) => {
        // Muted autoplay fallback
        video.muted = true;
        video.play().catch(() => {});
      });
    });

    // Event: Fragment loaded - buffering complete
    hls.on(Events.FRAG_LOADED, () => {
      this.callbacks.onBuffering?.(false);
    });

    // Event: Buffering
    hls.on(Events.FRAG_LOADING, () => {
      this.callbacks.onBuffering?.(true);
    });

    // Event: Quality level changed
    hls.on(Events.LEVEL_SWITCHED, (_, data) => {
      this.callbacks.onQualityChange?.(data.level, hls.levels.length - 1);
    });

    // Event: Error handling
    hls.on(Events.ERROR, (_, data) => {
      this.handleHlsError(data, video, url);
    });

    // Load and attach
    hls.loadSource(url);
    hls.attachMedia(video);

    return true;
  }

  /**
   * Attach using native HLS (Safari)
   */
  private attachNative(video: HTMLVideoElement, url: string): boolean {
    video.src = url;

    const handleError = () => {
      this.callbacks.onError?.({
        type: 'network',
        message: 'Erro ao carregar stream',
        recoverable: true,
      });
    };

    const handleLoaded = () => {
      this.callbacks.onReady?.();
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    video.addEventListener('error', handleError, { once: true });

    return true;
  }

  /**
   * Handle HLS.js errors with smart recovery
   */
  private handleHlsError(data: ErrorData, video: HTMLVideoElement, url: string): void {
    console.error('[PlayerEngine] Error:', data.type, data.details);

    // Handle 403 - session expired
    if (data.response?.code === 403) {
      this.handle403Error(url);
      return;
    }

    if (!data.fatal) {
      return; // Non-fatal errors are auto-recovered by HLS.js
    }

    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        this.handleNetworkError(url);
        break;

      case Hls.ErrorTypes.MEDIA_ERROR:
        this.handleMediaError();
        break;

      default:
        this.callbacks.onError?.({
          type: 'fatal',
          message: 'Erro fatal ao reproduzir',
          recoverable: false,
        });
    }
  }

  /**
   * Handle 403 Forbidden - Session expired
   * Destroy player and reload m3u8
   */
  private handle403Error(url: string): void {
    console.warn('[PlayerEngine] 403 Forbidden - Session expired');

    // Prevent infinite loops
    if (this.retryCount >= this.maxRetries || this.lastErrorUrl === url) {
      this.callbacks.onError?.({
        type: 'auth',
        code: 403,
        message: 'Sessão expirada. Recarregue a página.',
        recoverable: false,
      });
      return;
    }

    this.retryCount++;
    this.lastErrorUrl = url;
    this.callbacks.onRecovering?.(this.retryCount, this.maxRetries);

    // Destroy and reload
    this.destroyHls();
    
    // Backoff delay before retry
    const delay = 1000 * Math.pow(2, this.retryCount - 1);
    setTimeout(() => {
      if (this.video && this.currentUrl) {
        console.log(`[PlayerEngine] Retry ${this.retryCount}/${this.maxRetries}`);
        this.attachHlsJs(this.video, this.currentUrl);
      }
    }, delay);
  }

  /**
   * Handle network errors with retry
   */
  private handleNetworkError(url: string): void {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.callbacks.onRecovering?.(this.retryCount, this.maxRetries);
      
      console.log(`[PlayerEngine] Network retry ${this.retryCount}/${this.maxRetries}`);
      this.hls?.startLoad();
    } else {
      this.callbacks.onError?.({
        type: 'network',
        message: 'Erro de conexão. Verifique sua internet.',
        recoverable: true,
      });
    }
  }

  /**
   * Handle media errors
   */
  private handleMediaError(): void {
    console.log('[PlayerEngine] Recovering media error');
    this.hls?.recoverMediaError();
  }

  /**
   * Reload the current stream (for error recovery)
   */
  reload(): void {
    if (this.video && this.currentUrl) {
      this.retryCount = 0;
      this.lastErrorUrl = null;
      this.attach(this.video, this.currentUrl);
    }
  }

  /**
   * Get current quality levels
   */
  getQualityLevels(): { index: number; height: number; bitrate: number }[] {
    if (!this.hls) return [];
    return this.hls.levels.map((level, index) => ({
      index,
      height: level.height,
      bitrate: level.bitrate,
    }));
  }

  /**
   * Set quality level (-1 for auto)
   */
  setQualityLevel(index: number): void {
    if (this.hls) {
      this.hls.currentLevel = index;
    }
  }

  /**
   * Get current stats
   */
  getStats(): PlayerStats | null {
    if (!this.hls || !this.video) return null;

    return {
      bitrate: this.hls.currentLevel >= 0 
        ? this.hls.levels[this.hls.currentLevel]?.bitrate || 0 
        : 0,
      buffered: this.video.buffered.length > 0
        ? this.video.buffered.end(this.video.buffered.length - 1) - this.video.currentTime
        : 0,
      droppedFrames: (this.video as any).webkitDroppedFrameCount || 0,
      latency: this.hls.latency || 0,
    };
  }

  /**
   * Destroy HLS instance
   */
  private destroyHls(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  /**
   * Destroy engine completely
   */
  destroy(): void {
    this.isDestroyed = true;
    this.destroyHls();
    
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    
    this.currentUrl = null;
    this.callbacks = {};
  }

  /**
   * Check if engine is active
   */
  isActive(): boolean {
    return !this.isDestroyed && this.hls !== null;
  }
}

export default PlayerEngine;
