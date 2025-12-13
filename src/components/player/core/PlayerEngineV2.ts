/**
 * PlayerEngineV2 - Enterprise HLS Engine
 * 
 * Engine otimizada para IPTV com:
 * - Configuração HLS.js enterprise
 * - Gestão inteligente de 403
 * - Retry com backoff exponencial
 * - Máx 3 tentativas antes de erro fatal
 * - Sem loop infinito
 */

import Hls, { ErrorData, Events } from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================
export interface PlayerEngineConfig {
  lowLatency?: boolean;
  maxRetries?: number;
  onReady?: () => void;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (error: PlayerError) => void;
  onRecovering?: (attempt: number, maxAttempts: number) => void;
  onStats?: (stats: PlayerStats) => void;
}

export interface PlayerError {
  type: 'network' | 'media' | 'fatal';
  code: string;
  message: string;
  recoverable: boolean;
}

export interface PlayerStats {
  bitrate: number;
  buffered: number;
  dropped: number;
  latency: number;
}

// =============================================================================
// HLS CONFIGURATION - ENTERPRISE GRADE
// =============================================================================
const HLS_CONFIG: Partial<Hls['config']> = {
  enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 90,
  maxBufferLength: 30,
  maxBufferSize: 60 * 1000 * 1000, // 60MB
  maxBufferHole: 0.5,
  maxMaxBufferLength: 60,
  
  // Loading settings
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 3,
  fragLoadingRetryDelay: 800,
  fragLoadingMaxRetryTimeout: 32000,
  
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 2,
  manifestLoadingRetryDelay: 1000,
  manifestLoadingMaxRetryTimeout: 16000,
  
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 3,
  levelLoadingRetryDelay: 800,
  levelLoadingMaxRetryTimeout: 32000,
  
  // Start settings
  startLevel: -1, // Auto
  startPosition: -1, // Live edge
  
  // ABR settings
  abrEwmaDefaultEstimate: 1000000,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  
  // Live settings
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 10,
  liveDurationInfinity: true,
  
  // XHR setup for credentials
  xhrSetup: (xhr: XMLHttpRequest) => {
    xhr.withCredentials = true;
  },
};

// =============================================================================
// PLAYER ENGINE V2
// =============================================================================
export class PlayerEngineV2 {
  private hls: Hls | null = null;
  private video: HTMLVideoElement | null = null;
  private currentUrl: string | null = null;
  private config: PlayerEngineConfig;
  
  // Error tracking
  private errorCount = 0;
  private lastErrorTime = 0;
  private isRecovering = false;
  private readonly MAX_ERRORS = 3;
  private readonly ERROR_RESET_MS = 30000;
  
  constructor(config: PlayerEngineConfig = {}) {
    this.config = {
      lowLatency: true,
      maxRetries: 3,
      ...config,
    };
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================
  
  static isSupported(): boolean {
    return Hls.isSupported();
  }

  attach(video: HTMLVideoElement, url: string): boolean {
    if (!url.includes('.m3u8')) {
      console.error('[PlayerV2] Only .m3u8 URLs are supported');
      this.config.onError?.({
        type: 'fatal',
        code: 'INVALID_URL',
        message: 'Only HLS (.m3u8) streams are supported',
        recoverable: false,
      });
      return false;
    }

    this.video = video;
    this.currentUrl = url;
    this.errorCount = 0;

    // Use native HLS on Safari
    if (video.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      return this.attachNative(video, url);
    }

    if (!Hls.isSupported()) {
      console.error('[PlayerV2] HLS not supported');
      this.config.onError?.({
        type: 'fatal',
        code: 'HLS_NOT_SUPPORTED',
        message: 'HLS is not supported on this browser',
        recoverable: false,
      });
      return false;
    }

    return this.attachHlsJs(video, url);
  }

  reload(): void {
    if (!this.video || !this.currentUrl) return;
    
    console.log('[PlayerV2] Reloading stream...');
    this.destroy();
    this.attach(this.video, this.currentUrl);
  }

  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video = null;
    this.currentUrl = null;
    this.errorCount = 0;
    this.isRecovering = false;
  }

  getStats(): PlayerStats | null {
    if (!this.hls || !this.video) return null;

    const level = this.hls.levels[this.hls.currentLevel];
    
    return {
      bitrate: level?.bitrate || 0,
      buffered: this.getBufferedDuration(),
      dropped: (this.video as any).webkitDroppedFrameCount || 0,
      latency: this.hls.latency || 0,
    };
  }

  isActive(): boolean {
    return this.hls !== null || (this.video?.src !== '');
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private attachHlsJs(video: HTMLVideoElement, url: string): boolean {
    try {
      const hlsConfig = {
        ...HLS_CONFIG,
        lowLatencyMode: this.config.lowLatency,
      };

      this.hls = new Hls(hlsConfig);

      // Event handlers
      this.hls.on(Events.MANIFEST_PARSED, (_event, data) => {
        console.log(`[PlayerV2] Manifest parsed, levels: ${data.levels.length}`);
        this.errorCount = 0; // Reset on success
        video.play().catch(() => {
          // Autoplay blocked
        });
        this.config.onReady?.();
      });

      this.hls.on(Events.FRAG_LOADING, () => {
        this.config.onBuffering?.(true);
      });

      this.hls.on(Events.FRAG_LOADED, () => {
        this.errorCount = 0; // Reset on successful load
        this.config.onBuffering?.(false);
      });

      this.hls.on(Events.ERROR, (_event, data) => {
        this.handleError(data, video, url);
      });

      this.hls.on(Events.LEVEL_SWITCHED, (_event, data) => {
        console.log(`[PlayerV2] Quality: ${this.hls?.levels[data.level]?.height}p`);
      });

      this.hls.attachMedia(video);
      this.hls.loadSource(url);

      console.log(`[PlayerV2] Loading: ${url.substring(0, 60)}...`);
      return true;

    } catch (error) {
      console.error('[PlayerV2] Init error:', error);
      this.config.onError?.({
        type: 'fatal',
        code: 'INIT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to initialize player',
        recoverable: false,
      });
      return false;
    }
  }

  private attachNative(video: HTMLVideoElement, url: string): boolean {
    console.log('[PlayerV2] Using native HLS');
    
    video.src = url;
    
    video.addEventListener('loadedmetadata', () => {
      this.config.onReady?.();
    }, { once: true });

    video.addEventListener('error', () => {
      this.handleNativeError(video, url);
    });

    video.load();
    return true;
  }

  private handleError(data: ErrorData, video: HTMLVideoElement, url: string): void {
    const now = Date.now();
    
    // Reset error count after threshold
    if (now - this.lastErrorTime > this.ERROR_RESET_MS) {
      this.errorCount = 0;
    }
    this.lastErrorTime = now;

    console.error(`[PlayerV2] Error: ${data.type} - ${data.details}`);

    // Non-fatal errors - let HLS.js handle internally
    if (!data.fatal) {
      return;
    }

    // Prevent concurrent recovery attempts
    if (this.isRecovering) {
      console.log('[PlayerV2] Already recovering, skipping...');
      return;
    }

    this.errorCount++;
    console.log(`[PlayerV2] Error count: ${this.errorCount}/${this.MAX_ERRORS}`);

    // Check if we've exceeded max retries
    if (this.errorCount >= this.MAX_ERRORS) {
      console.error('[PlayerV2] Max retries exceeded, fatal error');
      this.config.onError?.({
        type: 'fatal',
        code: data.details,
        message: this.getErrorMessage(data),
        recoverable: false,
      });
      return;
    }

    // Attempt recovery
    this.isRecovering = true;
    this.config.onRecovering?.(this.errorCount, this.MAX_ERRORS);

    // Handle specific error types
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      this.handleNetworkError(data, url);
    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      this.handleMediaError();
    } else {
      // Unknown fatal error - try full reload
      this.scheduleReload(this.errorCount);
    }
  }

  private handleNetworkError(data: ErrorData, url: string): void {
    const status = (data.response as any)?.code;
    
    if (status === 403) {
      console.warn('[PlayerV2] 403 Forbidden - Session may have expired');
      // For 403, do a full reload to get fresh tokens
      this.scheduleReload(this.errorCount);
    } else {
      // Other network errors - try startLoad
      console.log('[PlayerV2] Network error, retrying...');
      const delay = this.getBackoffDelay(this.errorCount);
      
      setTimeout(() => {
        if (this.hls) {
          this.hls.startLoad();
        }
        this.isRecovering = false;
      }, delay);
    }
  }

  private handleMediaError(): void {
    console.log('[PlayerV2] Media error, attempting recovery...');
    
    if (this.hls) {
      if (this.errorCount === 1) {
        this.hls.recoverMediaError();
      } else {
        this.hls.swapAudioCodec();
        this.hls.recoverMediaError();
      }
    }
    
    setTimeout(() => {
      this.isRecovering = false;
    }, 1000);
  }

  private handleNativeError(video: HTMLVideoElement, url: string): void {
    const error = video.error;
    if (!error) return;

    this.errorCount++;
    console.error(`[PlayerV2] Native error: ${error.code} - ${error.message}`);

    if (this.errorCount >= this.MAX_ERRORS) {
      this.config.onError?.({
        type: 'fatal',
        code: `NATIVE_${error.code}`,
        message: error.message || 'Video playback failed',
        recoverable: false,
      });
      return;
    }

    this.config.onRecovering?.(this.errorCount, this.MAX_ERRORS);
    this.scheduleReload(this.errorCount);
  }

  private scheduleReload(attempt: number): void {
    const delay = this.getBackoffDelay(attempt);
    console.log(`[PlayerV2] Scheduling reload in ${delay}ms`);
    
    setTimeout(() => {
      this.isRecovering = false;
      this.reload();
    }, delay);
  }

  private getBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    const baseDelay = 1000;
    const delay = baseDelay * Math.pow(2, attempt - 1);
    // Add jitter
    const jitter = Math.random() * 500;
    return Math.min(delay + jitter, 8000);
  }

  private getBufferedDuration(): number {
    if (!this.video) return 0;
    
    const buffered = this.video.buffered;
    if (buffered.length === 0) return 0;
    
    const currentTime = this.video.currentTime;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
        return buffered.end(i) - currentTime;
      }
    }
    return 0;
  }

  private getErrorMessage(data: ErrorData): string {
    const status = (data.response as any)?.code;
    
    if (status === 403) {
      return 'Sessão expirada. Por favor, recarregue a página.';
    }
    if (status === 404) {
      return 'Canal não encontrado ou indisponível.';
    }
    if (data.details.includes('timeout')) {
      return 'Conexão lenta. Verifique sua internet.';
    }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      return 'Erro de reprodução. Tentando recuperar...';
    }
    
    return 'Erro ao carregar stream. Tente novamente.';
  }
}

export default PlayerEngineV2;
