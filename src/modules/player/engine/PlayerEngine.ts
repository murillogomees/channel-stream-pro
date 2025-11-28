/**
 * ============================================================================
 * Player Engine Enterprise - Core Player Engine
 * ============================================================================
 * 
 * Engine universal de playback com:
 * - State machine completa
 * - Tech adapters (HLS.js, Native, MSE)
 * - Auto-fallback entre engines
 * - Error recovery
 * - QoS monitoring
 * - Telemetria integrada
 * 
 * @version 3.0.0
 */

import Hls from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================

export type EngineState = 
  | 'idle' 
  | 'loading' 
  | 'buffering' 
  | 'playing' 
  | 'paused' 
  | 'stalled' 
  | 'retrying' 
  | 'error' 
  | 'fatal';

export type TechType = 'hls.js' | 'native' | 'mse' | 'auto';

export interface EngineConfig {
  preferredTech: TechType;
  maxRetries: number;
  retryDelay: number;
  stallTimeout: number;
  bufferGoal: number;
  lowLatency: boolean;
  debug: boolean;
}

export interface EngineEvents {
  onStateChange?: (state: EngineState, prevState: EngineState) => void;
  onError?: (error: EngineError) => void;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onBuffer?: (isBuffering: boolean) => void;
  onStall?: (duration: number) => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onQualityChange?: (level: number, auto: boolean) => void;
  onMetrics?: (metrics: EngineMetrics) => void;
}

export interface EngineError {
  type: 'network' | 'media' | 'decode' | 'format' | 'fatal';
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface EngineMetrics {
  startupTime: number;
  bufferLength: number;
  droppedFrames: number;
  bandwidth: number;
  currentLevel: number;
  levels: number;
  stalls: number;
  stallDuration: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: EngineConfig = {
  preferredTech: 'auto',
  maxRetries: 3,
  retryDelay: 1000,
  stallTimeout: 3000,
  bufferGoal: 30,
  lowLatency: false,
  debug: false,
};

const HLS_CONFIG: Partial<Hls['config']> = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 60,
  maxBufferLength: 60,
  maxMaxBufferLength: 120,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.5,
  startFragPrefetch: true,
  testBandwidth: true,
  progressive: true,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
  manifestLoadingTimeOut: 15000,
  manifestLoadingMaxRetry: 4,
  levelLoadingTimeOut: 15000,
  levelLoadingMaxRetry: 4,
};

// =============================================================================
// PLAYER ENGINE CLASS
// =============================================================================

export class PlayerEngine {
  private video: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private config: EngineConfig;
  private events: EngineEvents;
  
  private state: EngineState = 'idle';
  private currentUrl: string = '';
  private activeTech: TechType = 'auto';
  private retryCount = 0;
  
  // Metrics
  private loadStartTime = 0;
  private playStartTime = 0;
  private stallStart = 0;
  private totalStallDuration = 0;
  private stallCount = 0;

  // Timers
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<EngineConfig> = {}, events: EngineEvents = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.events = events;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Attach video element
   */
  attach(video: HTMLVideoElement): void {
    this.video = video;
    this.bindVideoEvents();
    this.log('Video element attached');
  }

  /**
   * Detach video element
   */
  detach(): void {
    this.unbindVideoEvents();
    this.video = null;
    this.log('Video element detached');
  }

  /**
   * Load a stream URL
   */
  async load(url: string): Promise<boolean> {
    if (!this.video) {
      this.handleError({
        type: 'fatal',
        code: 'NO_VIDEO_ELEMENT',
        message: 'No video element attached',
        recoverable: false,
      });
      return false;
    }

    this.currentUrl = url;
    this.loadStartTime = performance.now();
    this.retryCount = 0;
    this.resetMetrics();

    this.setState('loading');
    this.log('Loading:', url.substring(0, 60));

    // Select best tech
    this.activeTech = this.selectTech(url);
    this.log('Selected tech:', this.activeTech);

    try {
      switch (this.activeTech) {
        case 'hls.js':
          return await this.loadHls(url);
        case 'native':
          return await this.loadNative(url);
        default:
          return await this.loadAuto(url);
      }
    } catch (error) {
      this.handleError({
        type: 'network',
        code: 'LOAD_FAILED',
        message: error instanceof Error ? error.message : 'Load failed',
        recoverable: true,
      });
      return false;
    }
  }

  /**
   * Play
   */
  async play(): Promise<boolean> {
    if (!this.video) return false;

    try {
      await this.video.play();
      return true;
    } catch (error) {
      // Try muted autoplay
      this.log('Autoplay blocked, trying muted');
      this.video.muted = true;
      try {
        await this.video.play();
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Pause
   */
  pause(): void {
    this.video?.pause();
  }

  /**
   * Seek to time
   */
  seek(time: number): void {
    if (this.video) {
      this.video.currentTime = Math.max(0, Math.min(time, this.video.duration || 0));
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Set muted
   */
  setMuted(muted: boolean): void {
    if (this.video) {
      this.video.muted = muted;
    }
  }

  /**
   * Set quality level (for HLS)
   */
  setQuality(level: number): void {
    if (this.hls) {
      this.hls.currentLevel = level;
      this.log('Quality set to level:', level);
    }
  }

  /**
   * Get available quality levels
   */
  getQualityLevels(): Array<{ height: number; bitrate: number; index: number }> {
    if (!this.hls) return [];
    
    return this.hls.levels.map((level, index) => ({
      height: level.height,
      bitrate: level.bitrate,
      index,
    }));
  }

  /**
   * Get current metrics
   */
  getMetrics(): EngineMetrics {
    const startupTime = this.playStartTime > 0 
      ? this.playStartTime - this.loadStartTime 
      : 0;

    return {
      startupTime,
      bufferLength: this.getBufferLength(),
      droppedFrames: this.getDroppedFrames(),
      bandwidth: this.hls?.bandwidthEstimate || 0,
      currentLevel: this.hls?.currentLevel ?? -1,
      levels: this.hls?.levels.length || 0,
      stalls: this.stallCount,
      stallDuration: this.totalStallDuration,
    };
  }

  /**
   * Get current state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Destroy engine
   */
  destroy(): void {
    this.clearTimers();
    this.destroyHls();
    this.unbindVideoEvents();
    this.video = null;
    this.setState('idle');
    this.log('Engine destroyed');
  }

  /**
   * Reload current stream
   */
  async reload(): Promise<boolean> {
    if (!this.currentUrl) return false;
    return this.load(this.currentUrl);
  }

  // ===========================================================================
  // TECH LOADERS
  // ===========================================================================

  private selectTech(url: string): TechType {
    if (this.config.preferredTech !== 'auto') {
      return this.config.preferredTech;
    }

    // Check HLS.js support
    const isHlsSupported = Hls.isSupported();
    
    // Check native HLS support (Safari, iOS)
    const isNativeHls = this.video?.canPlayType('application/vnd.apple.mpegurl') !== '';

    // HLS URL detection
    const isHlsUrl = url.toLowerCase().includes('.m3u8');

    if (isHlsUrl) {
      // Prefer HLS.js for better control, but use native on Safari/iOS
      if (isNativeHls && !isHlsSupported) {
        return 'native';
      }
      return isHlsSupported ? 'hls.js' : 'native';
    }

    return 'native';
  }

  private async loadHls(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.video) {
        resolve(false);
        return;
      }

      this.destroyHls();

      const hls = new Hls(HLS_CONFIG);
      this.hls = hls;

      hls.loadSource(url);
      hls.attachMedia(this.video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.log('HLS manifest parsed');
        this.events.onReady?.();
        
        if (this.video) {
          this.play();
        }
        resolve(true);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        this.handleHlsError(data);
        if (data.fatal) {
          resolve(false);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        this.events.onQualityChange?.(data.level, hls.autoLevelEnabled);
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (this.state === 'loading') {
          this.setState('buffering');
        }
      });
    });
  }

  private async loadNative(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.video) {
        resolve(false);
        return;
      }

      this.video.src = url;
      
      const handleCanPlay = () => {
        this.log('Native: can play');
        this.events.onReady?.();
        this.play();
        resolve(true);
      };

      const handleError = () => {
        this.handleError({
          type: 'media',
          code: 'NATIVE_LOAD_ERROR',
          message: 'Native playback failed',
          recoverable: true,
        });
        resolve(false);
      };

      this.video.addEventListener('canplay', handleCanPlay, { once: true });
      this.video.addEventListener('error', handleError, { once: true });
      
      this.video.load();
    });
  }

  private async loadAuto(url: string): Promise<boolean> {
    // Try HLS.js first
    if (Hls.isSupported() && url.toLowerCase().includes('.m3u8')) {
      this.activeTech = 'hls.js';
      const result = await this.loadHls(url);
      if (result) return true;
    }

    // Fallback to native
    this.log('Falling back to native');
    this.activeTech = 'native';
    return this.loadNative(url);
  }

  private destroyHls(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  private handleHlsError(data: { type: string; details: string; fatal: boolean }): void {
    this.log('HLS Error:', data.type, data.details);

    if (!data.fatal) return;

    if (data.type === 'networkError') {
      this.handleNetworkError();
    } else if (data.type === 'mediaError') {
      this.log('Attempting media error recovery');
      this.hls?.recoverMediaError();
    } else {
      this.handleError({
        type: 'fatal',
        code: data.details,
        message: `Fatal HLS error: ${data.details}`,
        recoverable: false,
      });
    }
  }

  private handleNetworkError(): void {
    if (this.retryCount < this.config.maxRetries) {
      this.retryCount++;
      this.setState('retrying');
      this.log(`Network error, retry ${this.retryCount}/${this.config.maxRetries}`);
      
      this.retryTimer = setTimeout(() => {
        this.hls?.startLoad();
      }, this.config.retryDelay * this.retryCount);
    } else {
      this.handleError({
        type: 'network',
        code: 'MAX_RETRIES',
        message: 'Max retries exceeded',
        recoverable: false,
      });
    }
  }

  private handleError(error: EngineError): void {
    this.log('Error:', error.code, error.message);
    this.events.onError?.(error);
    
    if (!error.recoverable) {
      this.setState('fatal');
    } else {
      this.setState('error');
    }
  }

  // ===========================================================================
  // VIDEO EVENTS
  // ===========================================================================

  private bindVideoEvents(): void {
    if (!this.video) return;

    this.video.addEventListener('play', this.onPlay);
    this.video.addEventListener('pause', this.onPause);
    this.video.addEventListener('playing', this.onPlaying);
    this.video.addEventListener('waiting', this.onWaiting);
    this.video.addEventListener('stalled', this.onStalled);
    this.video.addEventListener('timeupdate', this.onTimeUpdate);
    this.video.addEventListener('error', this.onVideoError);
  }

  private unbindVideoEvents(): void {
    if (!this.video) return;

    this.video.removeEventListener('play', this.onPlay);
    this.video.removeEventListener('pause', this.onPause);
    this.video.removeEventListener('playing', this.onPlaying);
    this.video.removeEventListener('waiting', this.onWaiting);
    this.video.removeEventListener('stalled', this.onStalled);
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    this.video.removeEventListener('error', this.onVideoError);
  }

  private onPlay = (): void => {
    if (this.playStartTime === 0) {
      this.playStartTime = performance.now();
    }
    this.events.onPlay?.();
  };

  private onPause = (): void => {
    this.setState('paused');
    this.events.onPause?.();
  };

  private onPlaying = (): void => {
    this.setState('playing');
    this.clearStallTimer();
    this.events.onBuffer?.(false);
  };

  private onWaiting = (): void => {
    this.setState('buffering');
    this.events.onBuffer?.(true);
    this.startStallTimer();
  };

  private onStalled = (): void => {
    if (this.stallStart === 0) {
      this.stallStart = performance.now();
      this.stallCount++;
    }
    this.setState('stalled');
    this.startStallTimer();
  };

  private onTimeUpdate = (): void => {
    if (this.video) {
      this.events.onTimeUpdate?.(this.video.currentTime, this.video.duration);
    }
  };

  private onVideoError = (): void => {
    const error = this.video?.error;
    this.handleError({
      type: 'media',
      code: `MEDIA_ERROR_${error?.code || 'UNKNOWN'}`,
      message: error?.message || 'Video element error',
      recoverable: true,
    });
  };

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private setState(state: EngineState): void {
    if (state === this.state) return;
    
    const prevState = this.state;
    this.state = state;
    
    this.log('State:', prevState, '->', state);
    this.events.onStateChange?.(state, prevState);
  }

  private startStallTimer(): void {
    if (this.stallTimer) return;
    
    this.stallTimer = setTimeout(() => {
      if (this.stallStart > 0) {
        this.totalStallDuration += performance.now() - this.stallStart;
        this.events.onStall?.(this.totalStallDuration);
      }
      
      // Try recovery
      if (this.hls) {
        this.log('Attempting stall recovery');
        this.hls.startLoad();
      }
    }, this.config.stallTimeout);
  }

  private clearStallTimer(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
    
    if (this.stallStart > 0) {
      this.totalStallDuration += performance.now() - this.stallStart;
      this.stallStart = 0;
    }
  }

  private clearTimers(): void {
    this.clearStallTimer();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private resetMetrics(): void {
    this.stallCount = 0;
    this.totalStallDuration = 0;
    this.stallStart = 0;
    this.playStartTime = 0;
  }

  private getBufferLength(): number {
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

  private getDroppedFrames(): number {
    if (!this.video) return 0;
    
    // @ts-ignore - webkitDroppedFrameCount is non-standard
    return this.video.webkitDroppedFrameCount || 
           // @ts-ignore - getVideoPlaybackQuality is standard
           this.video.getVideoPlaybackQuality?.()?.droppedVideoFrames || 0;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[PlayerEngine]', ...args);
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export function createPlayerEngine(
  config?: Partial<EngineConfig>, 
  events?: EngineEvents
): PlayerEngine {
  return new PlayerEngine(config, events);
}

export default PlayerEngine;
