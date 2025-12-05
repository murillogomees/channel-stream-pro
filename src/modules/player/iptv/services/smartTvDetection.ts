/**
 * Smart TV Detection and Platform Configuration
 * Detects Samsung Tizen, LG WebOS, Android TV, Fire TV, Roku, etc.
 */

export type SmartTvPlatform = 
  | 'tizen'      // Samsung Smart TV
  | 'webos'      // LG Smart TV
  | 'android_tv' // Android TV / Google TV
  | 'fire_tv'    // Amazon Fire TV
  | 'roku'       // Roku (limited web support)
  | 'chromecast' // Chromecast
  | 'playstation'// PlayStation browser
  | 'xbox'       // Xbox browser
  | 'desktop'    // Desktop browser
  | 'mobile'     // Mobile browser
  | 'unknown';

export interface SmartTvInfo {
  platform: SmartTvPlatform;
  isSmartTv: boolean;
  isTv: boolean; // Includes desktop TVs
  supportsWebWorkers: boolean;
  supportsMSE: boolean; // Media Source Extensions
  supportsHls: boolean;
  recommendedBufferSize: number; // seconds
  maxResolution: '4k' | '1080p' | '720p' | '480p';
  hasHardwareDecoding: boolean;
  remoteFriendly: boolean;
  model?: string;
  osVersion?: string;
}

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
    
    this.cachedInfo = {
      platform,
      isSmartTv: this.isSmartTvPlatform(platform),
      isTv: this.isTvPlatform(platform),
      supportsWebWorkers: this.checkWebWorkersSupport(platform),
      supportsMSE: this.checkMseSupport(),
      supportsHls: this.checkHlsSupport(),
      recommendedBufferSize: this.getRecommendedBuffer(platform),
      maxResolution: this.getMaxResolution(platform),
      hasHardwareDecoding: this.hasHardwareDecoding(platform),
      remoteFriendly: this.isRemoteFriendly(platform),
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
      if (ua.includes('mobile')) return 'mobile';
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
    
    // Roku (limited)
    if (ua.includes('roku')) {
      return 'roku';
    }
    
    // Mobile
    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return 'mobile';
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

  private checkWebWorkersSupport(platform: SmartTvPlatform): boolean {
    // Samsung Tizen has buggy Web Worker support
    if (platform === 'tizen') return false;
    
    // Old WebOS versions have issues
    if (platform === 'webos') {
      const ua = navigator.userAgent;
      const webosMatch = ua.match(/Web0S[^\d]*(\d+)/i);
      if (webosMatch && parseInt(webosMatch[1]) < 5) return false;
    }
    
    return typeof Worker !== 'undefined';
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

  private getRecommendedBuffer(platform: SmartTvPlatform): number {
    switch (platform) {
      case 'tizen':
      case 'webos':
        return 30; // Larger buffer for stability
      case 'fire_tv':
      case 'android_tv':
        return 20;
      case 'chromecast':
        return 15;
      case 'roku':
        return 30;
      default:
        return 10;
    }
  }

  private getMaxResolution(platform: SmartTvPlatform): '4k' | '1080p' | '720p' | '480p' {
    switch (platform) {
      case 'tizen':
      case 'webos':
      case 'android_tv':
      case 'fire_tv':
        return '4k';
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
   * Get optimized HLS.js config for current platform
   */
  getHlsConfig(): Record<string, any> {
    const info = this.detect();
    
    const baseConfig = {
      enableWorker: info.supportsWebWorkers,
      lowLatencyMode: !info.isSmartTv, // Disable low latency on TVs for stability
      backBufferLength: 30,
      maxBufferLength: info.recommendedBufferSize,
      maxMaxBufferLength: info.recommendedBufferSize * 2,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxBufferHole: 0.5,
      startLevel: -1, // Auto
      capLevelToPlayerSize: true,
    };

    // Platform-specific tweaks
    if (info.platform === 'tizen') {
      return {
        ...baseConfig,
        enableWorker: false,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 2000,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        levelLoadingTimeOut: 20000,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        startFragPrefetch: false, // Disable prefetch on Tizen
      };
    }

    if (info.platform === 'webos') {
      return {
        ...baseConfig,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 5,
        fragLoadingRetryDelay: 1500,
        startFragPrefetch: true,
      };
    }

    if (info.platform === 'fire_tv' || info.platform === 'android_tv') {
      return {
        ...baseConfig,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 4,
        startFragPrefetch: true,
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
      // TV viewers sit further away, need larger UI
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
}

export const smartTvDetection = new SmartTvDetection();
