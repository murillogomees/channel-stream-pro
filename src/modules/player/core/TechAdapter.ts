/**
 * ============================================================================
 * TechAdapter - Adaptadores de Tecnologia de Playback
 * ============================================================================
 * 
 * Abstrai diferentes engines de playback:
 * - Native HTML5 Video
 * - HLS.js
 * - (Future: DASH.js, Shaka Player)
 * 
 * @version 1.0.0
 */

import Hls from 'hls.js';

// =============================================================================
// TYPES
// =============================================================================

export type TechType = 'native' | 'hlsjs' | 'dashjs' | 'shaka';

export interface TechCapabilities {
  hls: boolean;
  dash: boolean;
  mse: boolean;
  eme: boolean;
  nativeHls: boolean;
}

export interface TechAdapterEvents {
  onManifestLoaded?: () => void;
  onLevelLoaded?: (level: number, bitrate: number) => void;
  onFragLoaded?: () => void;
  onError?: (type: string, details: string, fatal: boolean) => void;
  onBufferAppended?: () => void;
  onQualityChange?: (level: number, bitrate: number) => void;
}

export interface TechAdapterConfig {
  maxBufferLength?: number;
  maxMaxBufferLength?: number;
  startLevel?: number;
  autoLevelEnabled?: boolean;
  debug?: boolean;
}

// =============================================================================
// BASE ADAPTER
// =============================================================================

export abstract class BaseTechAdapter {
  protected video: HTMLVideoElement;
  protected events: TechAdapterEvents;
  protected config: TechAdapterConfig;

  constructor(
    video: HTMLVideoElement, 
    events: TechAdapterEvents = {},
    config: TechAdapterConfig = {}
  ) {
    this.video = video;
    this.events = events;
    this.config = config;
  }

  abstract load(url: string): void;
  abstract destroy(): void;
  abstract isSupported(): boolean;
  abstract getCurrentLevel(): number;
  abstract getLevels(): { bitrate: number; height: number; width: number }[];
  abstract setLevel(level: number): void;
  abstract getBufferLength(): number;

  play(): Promise<void> {
    return this.video.play();
  }

  pause(): void {
    this.video.pause();
  }

  seek(time: number): void {
    this.video.currentTime = time;
  }

  setVolume(volume: number): void {
    this.video.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean): void {
    this.video.muted = muted;
  }
}

// =============================================================================
// NATIVE ADAPTER
// =============================================================================

export class NativeAdapter extends BaseTechAdapter {
  load(url: string): void {
    this.video.src = url;
    this.video.load();

    this.video.addEventListener('loadedmetadata', () => {
      this.events.onManifestLoaded?.();
    });

    this.video.addEventListener('error', () => {
      const error = this.video.error;
      this.events.onError?.(
        'media',
        error?.message || 'Unknown error',
        true
      );
    });
  }

  destroy(): void {
    this.video.src = '';
    this.video.load();
  }

  isSupported(): boolean {
    return !!this.video.canPlayType('application/vnd.apple.mpegurl');
  }

  getCurrentLevel(): number {
    return -1; // Auto
  }

  getLevels(): { bitrate: number; height: number; width: number }[] {
    return []; // Native doesn't expose levels
  }

  setLevel(level: number): void {
    // Native doesn't support manual level switching
  }

  getBufferLength(): number {
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
}

// =============================================================================
// HLS.JS ADAPTER
// =============================================================================

export class HlsJsAdapter extends BaseTechAdapter {
  private hls: Hls | null = null;

  load(url: string): void {
    if (!Hls.isSupported()) {
      console.error('[HlsJsAdapter] HLS.js not supported');
      return;
    }

    this.destroy();

    this.hls = new Hls({
      maxBufferLength: this.config.maxBufferLength ?? 60,
      maxMaxBufferLength: this.config.maxMaxBufferLength ?? 120,
      startLevel: this.config.startLevel ?? -1,
      autoStartLoad: true,
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 60,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 0.5,
      startFragPrefetch: true,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 4,
      levelLoadingTimeOut: 15000,
      levelLoadingMaxRetry: 4,
      debug: this.config.debug ?? false,
    });

    this.hls.loadSource(url);
    this.hls.attachMedia(this.video);

    // Event handlers
    this.hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      console.log(`[HlsJsAdapter] Manifest parsed: ${data.levels.length} levels`);
      this.events.onManifestLoaded?.();
    });

    this.hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const level = this.hls?.levels[data.level];
      this.events.onLevelLoaded?.(data.level, level?.bitrate || 0);
    });

    this.hls.on(Hls.Events.FRAG_LOADED, () => {
      this.events.onFragLoaded?.();
    });

    this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      const level = this.hls?.levels[data.level];
      this.events.onQualityChange?.(data.level, level?.bitrate || 0);
    });

    this.hls.on(Hls.Events.BUFFER_APPENDED, () => {
      this.events.onBufferAppended?.();
    });

    this.hls.on(Hls.Events.ERROR, (_, data) => {
      console.error('[HlsJsAdapter] Error:', data);
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[HlsJsAdapter] Network error, attempting recovery...');
            this.hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[HlsJsAdapter] Media error, attempting recovery...');
            this.hls?.recoverMediaError();
            break;
          default:
            this.events.onError?.(data.type, data.details, true);
            break;
        }
      } else {
        this.events.onError?.(data.type, data.details, false);
      }
    });
  }

  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  isSupported(): boolean {
    return Hls.isSupported();
  }

  getCurrentLevel(): number {
    return this.hls?.currentLevel ?? -1;
  }

  getLevels(): { bitrate: number; height: number; width: number }[] {
    return (this.hls?.levels || []).map(level => ({
      bitrate: level.bitrate,
      height: level.height,
      width: level.width,
    }));
  }

  setLevel(level: number): void {
    if (this.hls) {
      this.hls.currentLevel = level;
    }
  }

  getBufferLength(): number {
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

  // HLS.js specific methods
  startLoad(startPosition?: number): void {
    this.hls?.startLoad(startPosition);
  }

  recoverMediaError(): void {
    this.hls?.recoverMediaError();
  }
}

// =============================================================================
// TECH DETECTOR
// =============================================================================

export function detectCapabilities(): TechCapabilities {
  const video = document.createElement('video');

  return {
    hls: Hls.isSupported() || !!video.canPlayType('application/vnd.apple.mpegurl'),
    dash: 'MediaSource' in window,
    mse: 'MediaSource' in window,
    eme: 'requestMediaKeySystemAccess' in navigator,
    nativeHls: !!video.canPlayType('application/vnd.apple.mpegurl'),
  };
}

export function selectBestTech(url: string): TechType {
  const caps = detectCapabilities();
  const isHls = url.includes('.m3u8') || url.includes('m3u');

  if (isHls) {
    // Prefer native HLS on Safari/iOS
    if (caps.nativeHls) {
      return 'native';
    }
    // Fall back to HLS.js
    if (Hls.isSupported()) {
      return 'hlsjs';
    }
  }

  // Default to native
  return 'native';
}

export function createAdapter(
  type: TechType,
  video: HTMLVideoElement,
  events: TechAdapterEvents = {},
  config: TechAdapterConfig = {}
): BaseTechAdapter {
  switch (type) {
    case 'hlsjs':
      return new HlsJsAdapter(video, events, config);
    case 'native':
    default:
      return new NativeAdapter(video, events, config);
  }
}

export default {
  detectCapabilities,
  selectBestTech,
  createAdapter,
  NativeAdapter,
  HlsJsAdapter,
};
