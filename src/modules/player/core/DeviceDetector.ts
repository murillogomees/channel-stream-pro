/**
 * ============================================================================
 * DeviceDetector - Device Abstraction Layer
 * ============================================================================
 * 
 * Detects and provides information about:
 * - Platform (Tizen, webOS, Android TV, Fire TV, Browser)
 * - Device capabilities
 * - Input methods
 * - Display characteristics
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type Platform = 
  | 'tizen'      // Samsung Smart TV
  | 'webos'      // LG Smart TV
  | 'android-tv' // Android TV / Google TV
  | 'fire-tv'    // Amazon Fire TV
  | 'tvos'       // Apple TV (web app)
  | 'browser'    // Desktop/Mobile browser
  | 'webview'    // Mobile WebView
  | 'unknown';

export type InputMethod = 
  | 'remote'     // TV remote
  | 'keyboard'   // Physical keyboard
  | 'touch'      // Touch screen
  | 'gamepad';   // Game controller

export interface DeviceCapabilities {
  // Video
  supportsHls: boolean;
  supportsNativeHls: boolean;
  supportsMse: boolean;
  supportsEme: boolean;
  supports4K: boolean;
  supportsHdr: boolean;
  
  // Audio
  supportsDolbyDigital: boolean;
  supportsDolbyAtmos: boolean;
  
  // UI
  supportsSafeArea: boolean;
  supportsPointer: boolean;
  supportsTouch: boolean;
  
  // Performance
  isLowEnd: boolean;
  maxBufferLength: number;
}

export interface DeviceInfo {
  platform: Platform;
  platformVersion: string;
  modelName: string;
  inputMethods: InputMethod[];
  capabilities: DeviceCapabilities;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  isTv: boolean;
  isMobile: boolean;
  isEmbedded: boolean;
}

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

function detectPlatform(): { platform: Platform; version: string; model: string } {
  const ua = navigator.userAgent;
  
  // Samsung Tizen
  if (ua.includes('Tizen') || (window as any).tizen) {
    const versionMatch = ua.match(/Tizen\s*([\d.]+)/);
    return {
      platform: 'tizen',
      version: versionMatch?.[1] || 'unknown',
      model: 'Samsung Smart TV',
    };
  }
  
  // LG webOS
  if (ua.includes('Web0S') || ua.includes('webOS') || (window as any).webOS) {
    const versionMatch = ua.match(/Web0S\.?\s*TV-(\d+)/i) || ua.match(/webOS\.?\s*TV-?(\d+)?/i);
    return {
      platform: 'webos',
      version: versionMatch?.[1] || 'unknown',
      model: 'LG Smart TV',
    };
  }
  
  // Amazon Fire TV
  if (ua.includes('AFTT') || ua.includes('AFTS') || ua.includes('AFTM') || ua.includes('Fire TV')) {
    return {
      platform: 'fire-tv',
      version: 'unknown',
      model: 'Amazon Fire TV',
    };
  }
  
  // Android TV (not Fire TV)
  if (ua.includes('Android TV') || (ua.includes('Android') && ua.includes('TV'))) {
    const versionMatch = ua.match(/Android\s*([\d.]+)/);
    return {
      platform: 'android-tv',
      version: versionMatch?.[1] || 'unknown',
      model: 'Android TV',
    };
  }
  
  // tvOS (Apple TV web app)
  if (ua.includes('AppleTV')) {
    return {
      platform: 'tvos',
      version: 'unknown',
      model: 'Apple TV',
    };
  }
  
  // WebView detection
  if (
    ua.includes('wv') || 
    ua.includes('WebView') ||
    (ua.includes('Android') && !ua.includes('Chrome/')) ||
    (window as any).ReactNativeWebView
  ) {
    return {
      platform: 'webview',
      version: 'unknown',
      model: 'WebView',
    };
  }
  
  // Default: Browser
  return {
    platform: 'browser',
    version: navigator.appVersion,
    model: getBrowserName(),
  };
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  
  return 'Unknown Browser';
}

function detectInputMethods(platform: Platform): InputMethod[] {
  const methods: InputMethod[] = [];
  
  // TV platforms use remote
  if (['tizen', 'webos', 'android-tv', 'fire-tv', 'tvos'].includes(platform)) {
    methods.push('remote');
  }
  
  // Check for keyboard
  if (platform === 'browser' || platform === 'webview') {
    methods.push('keyboard');
  }
  
  // Check for touch
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    methods.push('touch');
  }
  
  // Check for gamepad
  if ('getGamepads' in navigator) {
    methods.push('gamepad');
  }
  
  return methods;
}

function detectCapabilities(platform: Platform): DeviceCapabilities {
  const video = document.createElement('video');
  const isTv = ['tizen', 'webos', 'android-tv', 'fire-tv', 'tvos'].includes(platform);
  
  // HLS support
  const supportsNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl');
  const supportsMse = 'MediaSource' in window;
  
  // DRM support
  const supportsEme = 'requestMediaKeySystemAccess' in navigator;
  
  // Performance estimation
  const isLowEnd = isTv || 
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 2);
  
  // Touch support
  const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return {
    supportsHls: supportsNativeHls || supportsMse,
    supportsNativeHls,
    supportsMse,
    supportsEme,
    supports4K: window.screen.width >= 3840 || window.screen.height >= 2160,
    supportsHdr: false, // Would need specific detection
    supportsDolbyDigital: false, // Would need specific detection
    supportsDolbyAtmos: false, // Would need specific detection
    supportsSafeArea: isTv,
    supportsPointer: !isTv,
    supportsTouch,
    isLowEnd,
    maxBufferLength: isLowEnd ? 30 : 60,
  };
}

// =============================================================================
// DEVICE DETECTOR CLASS
// =============================================================================

class DeviceDetector {
  private _info: DeviceInfo | null = null;

  get info(): DeviceInfo {
    if (!this._info) {
      this._info = this.detect();
    }
    return this._info;
  }

  detect(): DeviceInfo {
    const { platform, version, model } = detectPlatform();
    const inputMethods = detectInputMethods(platform);
    const capabilities = detectCapabilities(platform);
    
    const isTv = ['tizen', 'webos', 'android-tv', 'fire-tv', 'tvos'].includes(platform);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !isTv;
    
    return {
      platform,
      platformVersion: version,
      modelName: model,
      inputMethods,
      capabilities,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
      isTv,
      isMobile,
      isEmbedded: platform === 'webview',
    };
  }

  // ===========================================================================
  // CONVENIENCE GETTERS
  // ===========================================================================

  get platform(): Platform {
    return this.info.platform;
  }

  get isTv(): boolean {
    return this.info.isTv;
  }

  get isMobile(): boolean {
    return this.info.isMobile;
  }

  get isLowEnd(): boolean {
    return this.info.capabilities.isLowEnd;
  }

  get supportsHls(): boolean {
    return this.info.capabilities.supportsHls;
  }

  get supportsNativeHls(): boolean {
    return this.info.capabilities.supportsNativeHls;
  }

  get needsFocusManagement(): boolean {
    return this.info.isTv || this.info.inputMethods.includes('remote');
  }

  get needsSafeArea(): boolean {
    return this.info.capabilities.supportsSafeArea;
  }

  // ===========================================================================
  // PLATFORM-SPECIFIC HELPERS
  // ===========================================================================

  getTizenApi(): any {
    return (window as any).tizen || null;
  }

  getWebOSApi(): any {
    return (window as any).webOS || null;
  }

  // Get recommended buffer length based on device
  getRecommendedBufferLength(): number {
    return this.info.capabilities.maxBufferLength;
  }

  // Get platform-specific exit behavior
  exitApp(): void {
    const { platform } = this.info;
    
    switch (platform) {
      case 'tizen':
        (window as any).tizen?.application?.getCurrentApplication()?.exit();
        break;
      case 'webos':
        (window as any).webOS?.platformBack?.();
        break;
      case 'fire-tv':
      case 'android-tv':
        // Android WebView back
        window.history.back();
        break;
      default:
        window.history.back();
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const deviceDetector = new DeviceDetector();
export default DeviceDetector;
