/**
 * Smart TV Detection and Platform Configuration
 * Detects Samsung Tizen, LG WebOS, Android TV, Fire TV, Roku, etc.
 * Uses platform-specific player configurations from system spec
 */

export type SmartTvPlatform = 
  | 'tizen'      // Samsung Smart TV
  | 'webos'      // LG Smart TV
  | 'android_tv' // Android TV / Google TV
  | 'fire_tv'    // Amazon Fire TV
  | 'roku'       // Roku
  | 'chromecast' // Chromecast
  | 'playstation'// PlayStation browser
  | 'xbox'       // Xbox browser
  | 'desktop'    // Desktop browser
  | 'ios'        // iOS
  | 'android'    // Android mobile
  | 'web'        // Web/PWA
  | 'unknown';

export interface PlatformPlayerConfig {
  webWorkers: boolean;
  buffer: number;
  lowLatency: boolean;
  retries: number;
  fragmentSize: number;
}

export interface SmartTvInfo {
  platform: SmartTvPlatform;
  isSmartTv: boolean;
  isTv: boolean;
  supportsWebWorkers: boolean;
  supportsMSE: boolean;
  supportsHls: boolean;
  recommendedBufferSize: number;
  maxResolution: '4k' | '1080p' | '720p' | '480p';
  hasHardwareDecoding: boolean;
  remoteFriendly: boolean;
  playerConfig: PlatformPlayerConfig;
  model?: string;
  osVersion?: string;
}

// Platform-specific configurations from system spec
const PLATFORM_CONFIGS: Record<SmartTvPlatform, PlatformPlayerConfig> = {
  tizen: { webWorkers: false, buffer: 30, lowLatency: false, retries: 6, fragmentSize: 4 },
  webos: { webWorkers: true, buffer: 30, lowLatency: false, retries: 5, fragmentSize: 4 },
  roku: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  android_tv: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  fire_tv: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  android: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  ios: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  desktop: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  web: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  chromecast: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  playstation: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  xbox: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
  unknown: { webWorkers: true, buffer: 20, lowLatency: false, retries: 4, fragmentSize: 2 },
};

interface TizenWindow extends Window {
  tizen?: {
    systeminfo?: {
      getPropertyValue: (property: string, success: (info: any) => void, error: () => void) => void;
    };
  };
  webapis?: {
    productinfo?: {
      getModel: () => string;
      getFirmware: () => string;
    };
  };
}

interface WebOSWindow extends Window {
  webOS?: {
    platform?: {
      tv?: boolean;
    };
    deviceInfo?: (callback: (info: any) => void) => void;
  };
  PalmSystem?: object;
}

class SmartTvDetection {
  private cachedInfo: SmartTvInfo | null = null;

  /**
   * Detect current platform
   */
  detect(): SmartTvInfo {
    if (this.cachedInfo) return this.cachedInfo;

    const ua = navigator.userAgent.toLowerCase();
    const platform = this.detectPlatform(ua);
    const playerConfig = PLATFORM_CONFIGS[platform];
    
    this.cachedInfo = {
      platform,
      isSmartTv: this.isSmartTvPlatform(platform),
      isTv: this.isTvPlatform(platform),
      supportsWebWorkers: playerConfig.webWorkers && typeof Worker !== 'undefined',
      supportsMSE: this.checkMseSupport(),
      supportsHls: this.checkHlsSupport(),
      recommendedBufferSize: playerConfig.buffer,
      maxResolution: this.getMaxResolution(platform),
      hasHardwareDecoding: this.hasHardwareDecoding(platform),
      remoteFriendly: this.isRemoteFriendly(platform),
      playerConfig,
      ...this.getModelInfo(platform),
    };

    console.log('[SmartTV] Detected:', this.cachedInfo);
    return this.cachedInfo;
  }

  private detectPlatform(ua: string): SmartTvPlatform {
    // Samsung Tizen
    if (ua.includes('tizen') || ua.includes('samsung') && ua.includes('smart-tv')) {
      return 'tizen';
    }
    
    // LG WebOS
    if (ua.includes('webos') || ua.includes('web0s') || ua.includes('netcast')) {
      return 'webos';
    }
    
    // Fire TV
    if (ua.includes('aftm') || ua.includes('aftt') || ua.includes('afts') || ua.includes('silk')) {
      if (ua.includes('mobile')) return 'android';
      return 'fire_tv';
    }
    
    // Android TV
    if ((ua.includes('android') && ua.includes('tv')) || ua.includes('android tv')) {
      return 'android_tv';
    }
    
    // Chromecast
    if (ua.includes('crkey')) {
      return 'chromecast';
    }
    
    // PlayStation
    if (ua.includes('playstation')) {
      return 'playstation';
    }
    
    // Xbox
    if (ua.includes('xbox')) {
      return 'xbox';
    }
    
    // Roku
    if (ua.includes('roku')) {
      return 'roku';
    }
    
    // iOS
    if (/iphone|ipad|ipod/i.test(ua)) {
      return 'ios';
    }
    
    // Android mobile
    if (/android/i.test(ua)) {
      return 'android';
    }
    
    // Check for TV-like characteristics
    if (this.hasTvCharacteristics()) {
      return 'android_tv';
    }
    
    return 'desktop';
  }

  private hasTvCharacteristics(): boolean {
    // Check screen size - TVs typically have large screens but low pixel density
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Large screen with low pixel density = likely TV
    if (screenWidth >= 1920 && pixelRatio <= 1.5) {
      // Additional check: no touch support
      if (!('ontouchstart' in window)) {
        return true;
      }
    }
    
    // Check for Tizen/WebOS global objects
    const win = window as TizenWindow & WebOSWindow;
    if (win.tizen || win.webOS || win.PalmSystem) {
      return true;
    }
    
    return false;
  }

  private isSmartTvPlatform(platform: SmartTvPlatform): boolean {
    return ['tizen', 'webos', 'android_tv', 'fire_tv', 'roku'].includes(platform);
  }

  private isTvPlatform(platform: SmartTvPlatform): boolean {
    return ['tizen', 'webos', 'android_tv', 'fire_tv', 'roku', 'chromecast', 'playstation', 'xbox'].includes(platform);
  }

  private checkMseSupport(): boolean {
    return 'MediaSource' in window && 
           typeof MediaSource.isTypeSupported === 'function';
  }

  private checkHlsSupport(): boolean {
    const video = document.createElement('video');
    return video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
           this.checkMseSupport();
  }

  private getMaxResolution(platform: SmartTvPlatform): '4k' | '1080p' | '720p' | '480p' {
    switch (platform) {
      case 'tizen':
      case 'webos':
      case 'android_tv':
      case 'fire_tv':
      case 'chromecast':
      case 'playstation':
      case 'xbox':
        return '4k';
      case 'roku':
        return '1080p';
      default:
        return '4k';
    }
  }

  private hasHardwareDecoding(platform: SmartTvPlatform): boolean {
    return ['tizen', 'webos', 'android_tv', 'fire_tv', 'chromecast', 'roku'].includes(platform);
  }

  private isRemoteFriendly(platform: SmartTvPlatform): boolean {
    return ['tizen', 'webos', 'android_tv', 'fire_tv', 'roku', 'chromecast', 'playstation', 'xbox'].includes(platform);
  }

  private getModelInfo(platform: SmartTvPlatform): { model?: string; osVersion?: string } {
    try {
      const win = window as TizenWindow & WebOSWindow;
      
      if (platform === 'tizen' && win.webapis?.productinfo) {
        return {
          model: win.webapis.productinfo.getModel(),
          osVersion: win.webapis.productinfo.getFirmware(),
        };
      }
      
      if (platform === 'webos' && win.webOS?.deviceInfo) {
        let info = {};
        win.webOS.deviceInfo((deviceInfo) => {
          info = { model: deviceInfo.modelName, osVersion: deviceInfo.version };
        });
        return info;
      }
    } catch (e) {
      console.warn('[SmartTV] Could not get model info:', e);
    }
    
    return {};
  }

  /**
   * Get optimized HLS.js config using platform-specific settings
   */
  getHlsConfig(): Record<string, any> {
    const info = this.detect();
    const config = info.playerConfig;

    const baseConfig = {
      enableWorker: config.webWorkers && info.supportsWebWorkers,
      lowLatencyMode: config.lowLatency,
      backBufferLength: info.isTv ? 30 : 60,
      maxBufferLength: config.buffer,
      maxMaxBufferLength: config.buffer * 2,
      maxBufferSize: config.buffer * 2 * 1000 * 1000,
      maxBufferHole: config.fragmentSize,
      fragLoadingMaxRetry: config.retries,
      manifestLoadingMaxRetry: config.retries,
      levelLoadingMaxRetry: config.retries,
      fragLoadingRetryDelay: 1000,
      startLevel: -1,
      capLevelToPlayerSize: true,
      startFragPrefetch: true,
      testBandwidth: true,
    };

    // Platform-specific optimizations
    if (info.platform === 'tizen') {
      return {
        ...baseConfig,
        enableWorker: false,
        fragLoadingTimeOut: 30000,
        fragLoadingRetryDelay: 2000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        startFragPrefetch: false,
        abrEwmaDefaultEstimate: 1000000,
        abrBandWidthFactor: 0.8,
      };
    }

    if (info.platform === 'webos') {
      return {
        ...baseConfig,
        fragLoadingTimeOut: 25000,
        fragLoadingRetryDelay: 1500,
        abrEwmaDefaultEstimate: 1000000,
        abrBandWidthFactor: 0.8,
      };
    }

    if (info.isTv) {
      return {
        ...baseConfig,
        fragLoadingTimeOut: 20000,
        abrEwmaDefaultEstimate: 1000000,
        abrBandWidthFactor: 0.8,
        abrBandWidthUpFactor: 0.5,
      };
    }

    return baseConfig;
  }

  /**
   * Get UI scale factor for TV viewing distance
   */
  getUiScale(): number {
    const info = this.detect();
    
    if (info.isTv) {
      return 1.5;
    }
    
    return 1;
  }

  /**
   * Check if should show focus indicators
   */
  shouldShowFocusIndicators(): boolean {
    const info = this.detect();
    return info.isTv || info.remoteFriendly;
  }

  /**
   * Get platform config
   */
  getPlatformConfig(): PlatformPlayerConfig {
    return this.detect().playerConfig;
  }
}

export const smartTvDetection = new SmartTvDetection();
