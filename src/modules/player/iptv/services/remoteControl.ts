/**
 * Remote Control / Keyboard Handler
 * Universal input handling for TV, Firestick, Desktop, Mobile
 */

export type RemoteAction = 
  | 'play' 
  | 'pause' 
  | 'togglePlay'
  | 'stop'
  | 'forward'
  | 'rewind'
  | 'volumeUp'
  | 'volumeDown'
  | 'mute'
  | 'fullscreen'
  | 'channelUp'
  | 'channelDown'
  | 'back'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'info'
  | 'guide'
  | 'menu'
  | 'number0' | 'number1' | 'number2' | 'number3' | 'number4'
  | 'number5' | 'number6' | 'number7' | 'number8' | 'number9';

export interface RemoteControlConfig {
  seekAmount?: number;  // seconds to seek
  volumeStep?: number;  // volume step 0-1
  holdDelay?: number;   // ms before hold triggers
}

// Key code mappings for different platforms
const KEY_MAPPINGS: Record<string, RemoteAction> = {
  // Standard keyboard
  'Space': 'togglePlay',
  'KeyK': 'togglePlay',
  'KeyP': 'togglePlay',
  'ArrowLeft': 'rewind',
  'ArrowRight': 'forward',
  'ArrowUp': 'volumeUp',
  'ArrowDown': 'volumeDown',
  'KeyM': 'mute',
  'KeyF': 'fullscreen',
  'Escape': 'back',
  'Enter': 'select',
  'KeyI': 'info',
  'KeyG': 'guide',
  
  // Number keys
  'Digit0': 'number0',
  'Digit1': 'number1',
  'Digit2': 'number2',
  'Digit3': 'number3',
  'Digit4': 'number4',
  'Digit5': 'number5',
  'Digit6': 'number6',
  'Digit7': 'number7',
  'Digit8': 'number8',
  'Digit9': 'number9',
  'Numpad0': 'number0',
  'Numpad1': 'number1',
  'Numpad2': 'number2',
  'Numpad3': 'number3',
  'Numpad4': 'number4',
  'Numpad5': 'number5',
  'Numpad6': 'number6',
  'Numpad7': 'number7',
  'Numpad8': 'number8',
  'Numpad9': 'number9',
  
  // Page Up/Down for channel switching
  'PageUp': 'channelUp',
  'PageDown': 'channelDown',
  'ChannelUp': 'channelUp',
  'ChannelDown': 'channelDown',
  
  // Android TV / Fire TV specific key codes
  '179': 'togglePlay',   // KEYCODE_MEDIA_PLAY_PAUSE
  '85': 'togglePlay',    // KEYCODE_MEDIA_PLAY_PAUSE
  '126': 'play',         // KEYCODE_MEDIA_PLAY
  '127': 'pause',        // KEYCODE_MEDIA_PAUSE
  '86': 'stop',          // KEYCODE_MEDIA_STOP
  '87': 'forward',       // KEYCODE_MEDIA_NEXT
  '88': 'rewind',        // KEYCODE_MEDIA_PREVIOUS
  '90': 'forward',       // KEYCODE_MEDIA_FAST_FORWARD
  '89': 'rewind',        // KEYCODE_MEDIA_REWIND
  '24': 'volumeUp',      // KEYCODE_VOLUME_UP
  '25': 'volumeDown',    // KEYCODE_VOLUME_DOWN
  '164': 'mute',         // KEYCODE_VOLUME_MUTE
  '4': 'back',           // KEYCODE_BACK
  '23': 'select',        // KEYCODE_DPAD_CENTER
  '165': 'channelUp',    // KEYCODE_TV_CHANNEL_UP
  '166': 'channelDown',  // KEYCODE_TV_CHANNEL_DOWN
  '82': 'menu',          // KEYCODE_MENU
  
  // Samsung Tizen TV
  '10009': 'back',       // TvKey.Return
  '10252': 'togglePlay', // TvKey.MediaPlayPause
  '10232': 'rewind',     // TvKey.MediaRewind
  '10233': 'forward',    // TvKey.MediaFastForward
  '427': 'channelUp',    // TvKey.ChannelUp
  '428': 'channelDown',  // TvKey.ChannelDown
  '457': 'info',         // TvKey.Info
  '458': 'guide',        // TvKey.Guide
  
  // LG WebOS TV
  '461': 'back',         // Back button
  '415': 'play',         // Play
  '19': 'pause',         // Pause
  '412': 'rewind',       // Rewind
  '417': 'forward',      // Fast Forward
};

export class RemoteControlService {
  private config: RemoteControlConfig;
  private listeners: Map<RemoteAction, Set<(action: RemoteAction) => void>> = new Map();
  private numberBuffer: string = '';
  private numberTimeout: ReturnType<typeof setTimeout> | null = null;
  private onChannelDirect?: (channelNum: number) => void;

  constructor(config?: RemoteControlConfig) {
    this.config = {
      seekAmount: 10,
      volumeStep: 0.1,
      holdDelay: 500,
      ...config,
    };
  }

  /**
   * Initialize and attach event listeners
   */
  initialize(element?: HTMLElement) {
    const target = element || document;
    
    target.addEventListener('keydown', this.handleKeyDown);
    
    // Touch gestures for mobile
    if ('ontouchstart' in window) {
      this.initTouchGestures(target as HTMLElement);
    }

    console.log('[Remote Control] Initialized');
  }

  /**
   * Cleanup event listeners
   */
  destroy(element?: HTMLElement) {
    const target = element || document;
    target.removeEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Subscribe to action
   */
  on(action: RemoteAction, callback: (action: RemoteAction) => void) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(callback);
    
    return () => {
      this.listeners.get(action)?.delete(callback);
    };
  }

  /**
   * Subscribe to direct channel input
   */
  onChannelInput(callback: (channelNum: number) => void) {
    this.onChannelDirect = callback;
    return () => {
      this.onChannelDirect = undefined;
    };
  }

  /**
   * Handle key down events
   */
  private handleKeyDown = (event: KeyboardEvent) => {
    const code = event.code || String(event.keyCode);
    const action = KEY_MAPPINGS[code];
    
    if (!action) {
      console.log('[Remote Control] Unmapped key:', code, event.keyCode);
      return;
    }

    // Handle number input for direct channel access
    if (action.startsWith('number')) {
      event.preventDefault();
      this.handleNumberInput(action.replace('number', ''));
      return;
    }

    event.preventDefault();
    this.emit(action);
  };

  /**
   * Handle number input for channel zapping
   */
  private handleNumberInput(digit: string) {
    this.numberBuffer += digit;
    
    // Clear previous timeout
    if (this.numberTimeout) {
      clearTimeout(this.numberTimeout);
    }

    // Wait for more digits or trigger after delay
    this.numberTimeout = setTimeout(() => {
      const channelNum = parseInt(this.numberBuffer, 10);
      if (!isNaN(channelNum) && this.onChannelDirect) {
        this.onChannelDirect(channelNum);
      }
      this.numberBuffer = '';
    }, 1500);
  }

  /**
   * Initialize touch gestures
   */
  private initTouchGestures(element: HTMLElement) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    element.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      const minSwipe = 50;
      const maxVertical = 100;

      // Tap detection
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && touchDuration < 300) {
        // Double tap detection would go here
        this.emit('togglePlay');
        return;
      }

      // Horizontal swipe
      if (Math.abs(deltaX) > minSwipe && Math.abs(deltaY) < maxVertical) {
        if (deltaX > 0) {
          this.emit('forward');
        } else {
          this.emit('rewind');
        }
        return;
      }

      // Vertical swipe (for volume or channel)
      if (Math.abs(deltaY) > minSwipe && Math.abs(deltaX) < maxVertical) {
        if (deltaY < 0) {
          this.emit('volumeUp');
        } else {
          this.emit('volumeDown');
        }
      }
    }, { passive: true });
  }

  /**
   * Emit action to listeners
   */
  private emit(action: RemoteAction) {
    console.log('[Remote Control] Action:', action);
    
    const callbacks = this.listeners.get(action);
    if (callbacks) {
      callbacks.forEach(cb => cb(action));
    }
  }

  /**
   * Get config
   */
  getConfig() {
    return { ...this.config };
  }
}

export const remoteControl = new RemoteControlService();
