/**
 * ============================================================================
 * RemoteKeyMap - Universal Remote Control Key Mapping
 * ============================================================================
 * 
 * Maps key codes from different TV platforms to unified actions:
 * - Samsung Tizen
 * - LG webOS
 * - Android TV / Fire TV
 * - Standard browser keyboards
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type RemoteAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'ok'
  | 'back'
  | 'play'
  | 'pause'
  | 'playpause'
  | 'stop'
  | 'rewind'
  | 'fastforward'
  | 'channel_up'
  | 'channel_down'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'info'
  | 'menu'
  | 'home'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'num_0'
  | 'num_1'
  | 'num_2'
  | 'num_3'
  | 'num_4'
  | 'num_5'
  | 'num_6'
  | 'num_7'
  | 'num_8'
  | 'num_9';

// =============================================================================
// KEY MAPPINGS
// =============================================================================

/**
 * Standard keyboard key names to actions
 */
const KEYBOARD_MAP: Record<string, RemoteAction> = {
  // Navigation
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'Enter': 'ok',
  ' ': 'playpause',  // Space
  'Escape': 'back',
  'Backspace': 'back',
  
  // Media keys
  'MediaPlayPause': 'playpause',
  'MediaPlay': 'play',
  'MediaPause': 'pause',
  'MediaStop': 'stop',
  'MediaRewind': 'rewind',
  'MediaFastForward': 'fastforward',
  'MediaTrackPrevious': 'channel_down',
  'MediaTrackNext': 'channel_up',
  
  // Volume
  'AudioVolumeUp': 'volume_up',
  'AudioVolumeDown': 'volume_down',
  'AudioVolumeMute': 'mute',
  
  // Navigation shortcuts
  'm': 'mute',
  'M': 'mute',
  'f': 'info',
  'F': 'info',
  'i': 'info',
  'I': 'info',
  
  // Number keys
  '0': 'num_0',
  '1': 'num_1',
  '2': 'num_2',
  '3': 'num_3',
  '4': 'num_4',
  '5': 'num_5',
  '6': 'num_6',
  '7': 'num_7',
  '8': 'num_8',
  '9': 'num_9',
};

/**
 * Samsung Tizen key codes
 * https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
 */
const TIZEN_KEYCODE_MAP: Record<number, RemoteAction> = {
  // Navigation
  38: 'up',
  40: 'down',
  37: 'left',
  39: 'right',
  13: 'ok',
  10009: 'back',      // Tizen BACK
  10182: 'back',      // Tizen EXIT
  
  // Media controls
  415: 'play',
  19: 'pause',
  10252: 'playpause',
  413: 'stop',
  412: 'rewind',
  417: 'fastforward',
  
  // Channel
  427: 'channel_up',
  428: 'channel_down',
  
  // Volume
  447: 'volume_up',
  448: 'volume_down',
  449: 'mute',
  
  // Info & Menu
  457: 'info',
  10133: 'menu',      // Tizen MENU
  10073: 'home',      // Tizen HOME
  
  // Color buttons
  403: 'red',
  404: 'green',
  405: 'yellow',
  406: 'blue',
  
  // Numbers
  48: 'num_0',
  49: 'num_1',
  50: 'num_2',
  51: 'num_3',
  52: 'num_4',
  53: 'num_5',
  54: 'num_6',
  55: 'num_7',
  56: 'num_8',
  57: 'num_9',
};

/**
 * LG webOS key codes
 * https://webostv.developer.lge.com/develop/guides/using-remote-control
 */
const WEBOS_KEYCODE_MAP: Record<number, RemoteAction> = {
  // Navigation (same as browser)
  38: 'up',
  40: 'down',
  37: 'left',
  39: 'right',
  13: 'ok',
  461: 'back',        // webOS BACK
  
  // Media controls
  415: 'play',
  19: 'pause',
  413: 'stop',
  412: 'rewind',
  417: 'fastforward',
  
  // Channel
  33: 'channel_up',   // Page Up
  34: 'channel_down', // Page Down
  
  // Color buttons
  403: 'red',
  404: 'green',
  405: 'yellow',
  406: 'blue',
  
  // Numbers (standard)
  48: 'num_0',
  49: 'num_1',
  50: 'num_2',
  51: 'num_3',
  52: 'num_4',
  53: 'num_5',
  54: 'num_6',
  55: 'num_7',
  56: 'num_8',
  57: 'num_9',
};

/**
 * Android TV / Fire TV key codes
 */
const ANDROID_TV_KEYCODE_MAP: Record<number, RemoteAction> = {
  // Navigation
  38: 'up',
  40: 'down',
  37: 'left',
  39: 'right',
  13: 'ok',
  8: 'back',          // Backspace
  27: 'back',         // Escape
  
  // D-pad specific
  19: 'up',           // KEYCODE_DPAD_UP
  20: 'down',         // KEYCODE_DPAD_DOWN
  21: 'left',         // KEYCODE_DPAD_LEFT
  22: 'right',        // KEYCODE_DPAD_RIGHT
  23: 'ok',           // KEYCODE_DPAD_CENTER
  
  // Media
  85: 'playpause',    // KEYCODE_MEDIA_PLAY_PAUSE
  126: 'play',        // KEYCODE_MEDIA_PLAY
  127: 'pause',       // KEYCODE_MEDIA_PAUSE
  86: 'stop',         // KEYCODE_MEDIA_STOP
  89: 'rewind',       // KEYCODE_MEDIA_REWIND
  90: 'fastforward',  // KEYCODE_MEDIA_FAST_FORWARD
  
  // Channel
  166: 'channel_up',  // KEYCODE_CHANNEL_UP
  167: 'channel_down',// KEYCODE_CHANNEL_DOWN
  
  // Volume
  24: 'volume_up',    // KEYCODE_VOLUME_UP
  25: 'volume_down',  // KEYCODE_VOLUME_DOWN
  164: 'mute',        // KEYCODE_VOLUME_MUTE
  
  // Menu/Home
  82: 'menu',         // KEYCODE_MENU
  3: 'home',          // KEYCODE_HOME
  
  // Color buttons (Fire TV)
  183: 'red',
  184: 'green',
  185: 'yellow',
  186: 'blue',
};

// =============================================================================
// REMOTE KEY MAP CLASS
// =============================================================================

export type Platform = 'tizen' | 'webos' | 'android-tv' | 'fire-tv' | 'browser' | 'unknown';

class RemoteKeyMap {
  private platform: Platform = 'browser';

  constructor() {
    this.detectPlatform();
  }

  private detectPlatform(): void {
    const ua = navigator.userAgent;
    
    if (ua.includes('Tizen') || (window as any).tizen) {
      this.platform = 'tizen';
      this.registerTizenKeys();
    } else if (ua.includes('Web0S') || ua.includes('webOS') || (window as any).webOS) {
      this.platform = 'webos';
    } else if (ua.includes('AFTT') || ua.includes('AFTS') || ua.includes('Fire TV')) {
      this.platform = 'fire-tv';
    } else if (ua.includes('Android TV') || (ua.includes('Android') && ua.includes('TV'))) {
      this.platform = 'android-tv';
    } else {
      this.platform = 'browser';
    }
  }

  /**
   * Register Tizen specific key handlers
   */
  private registerTizenKeys(): void {
    try {
      const tizen = (window as any).tizen;
      if (tizen?.tvinputdevice) {
        const keys = [
          'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
          'MediaRewind', 'MediaFastForward', 'MediaTrackPrevious', 'MediaTrackNext',
          'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
          'ChannelUp', 'ChannelDown', 'Info',
          '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        ];
        
        keys.forEach(key => {
          try {
            tizen.tvinputdevice.registerKey(key);
          } catch (e) {
            // Key may not be available
          }
        });
      }
    } catch (e) {
      console.warn('[RemoteKeyMap] Failed to register Tizen keys:', e);
    }
  }

  /**
   * Get the current platform
   */
  getPlatform(): Platform {
    return this.platform;
  }

  /**
   * Map a keyboard event to a remote action
   */
  mapEvent(event: KeyboardEvent): RemoteAction | null {
    // First try standard key name
    if (event.key && KEYBOARD_MAP[event.key]) {
      return KEYBOARD_MAP[event.key];
    }

    // Then try platform-specific keyCode
    const keyCode = event.keyCode;
    
    switch (this.platform) {
      case 'tizen':
        if (TIZEN_KEYCODE_MAP[keyCode]) {
          return TIZEN_KEYCODE_MAP[keyCode];
        }
        break;
        
      case 'webos':
        if (WEBOS_KEYCODE_MAP[keyCode]) {
          return WEBOS_KEYCODE_MAP[keyCode];
        }
        break;
        
      case 'android-tv':
      case 'fire-tv':
        if (ANDROID_TV_KEYCODE_MAP[keyCode]) {
          return ANDROID_TV_KEYCODE_MAP[keyCode];
        }
        break;
    }

    // Fallback: try browser keyCode mapping
    const browserAction = this.mapBrowserKeyCode(keyCode);
    if (browserAction) {
      return browserAction;
    }

    return null;
  }

  /**
   * Map browser keyCodes (legacy support)
   */
  private mapBrowserKeyCode(keyCode: number): RemoteAction | null {
    const BROWSER_KEYCODE_MAP: Record<number, RemoteAction> = {
      38: 'up',
      40: 'down',
      37: 'left',
      39: 'right',
      13: 'ok',
      27: 'back',
      8: 'back',
      32: 'playpause',
      33: 'channel_up',   // Page Up
      34: 'channel_down', // Page Down
    };
    
    return BROWSER_KEYCODE_MAP[keyCode] || null;
  }

  /**
   * Check if an action is a navigation action
   */
  isNavigationAction(action: RemoteAction): boolean {
    return ['up', 'down', 'left', 'right', 'ok', 'back'].includes(action);
  }

  /**
   * Check if an action is a media control action
   */
  isMediaAction(action: RemoteAction): boolean {
    return ['play', 'pause', 'playpause', 'stop', 'rewind', 'fastforward'].includes(action);
  }

  /**
   * Check if an action is a number key
   */
  isNumberAction(action: RemoteAction): boolean {
    return action.startsWith('num_');
  }

  /**
   * Get the number value from a number action
   */
  getNumberFromAction(action: RemoteAction): number | null {
    if (this.isNumberAction(action)) {
      return parseInt(action.replace('num_', ''), 10);
    }
    return null;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const remoteKeyMap = new RemoteKeyMap();
export default RemoteKeyMap;
