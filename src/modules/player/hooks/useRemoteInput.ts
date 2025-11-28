/**
 * ============================================================================
 * useRemoteInput - Hook para Controle Remoto de TVs
 * ============================================================================
 * 
 * Captura eventos de controle remoto em:
 * - Samsung Tizen
 * - LG webOS
 * - Android TV / Fire Stick
 * - Navegadores (teclado)
 * 
 * @version 1.0.0
 */

import { useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type RemoteAction = 
  | 'up' | 'down' | 'left' | 'right'
  | 'ok' | 'back' | 'play' | 'pause'
  | 'stop' | 'rewind' | 'forward'
  | 'channelUp' | 'channelDown'
  | 'volumeUp' | 'volumeDown' | 'mute'
  | 'info' | 'menu' | 'guide'
  | 'red' | 'green' | 'yellow' | 'blue'
  | 'number0' | 'number1' | 'number2' | 'number3' | 'number4'
  | 'number5' | 'number6' | 'number7' | 'number8' | 'number9';

interface RemoteHandlers {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onOk?: () => void;
  onBack?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onPlayPause?: () => void;
  onStop?: () => void;
  onRewind?: () => void;
  onForward?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onInfo?: () => void;
  onMenu?: () => void;
  onNumber?: (num: number) => void;
  onAnyKey?: (action: RemoteAction) => void;
}

interface UseRemoteInputOptions extends RemoteHandlers {
  enabled?: boolean;
  preventDefault?: boolean;
  debounceMs?: number;
}

// =============================================================================
// KEY MAPPINGS
// =============================================================================

const KEY_TO_ACTION: Record<string, RemoteAction> = {
  // Standard keyboard
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'Enter': 'ok',
  ' ': 'play',
  'Escape': 'back',
  'Backspace': 'back',
  'MediaPlayPause': 'play',
  'MediaPlay': 'play',
  'MediaPause': 'pause',
  'MediaStop': 'stop',
  'MediaRewind': 'rewind',
  'MediaFastForward': 'forward',
  'MediaTrackPrevious': 'channelDown',
  'MediaTrackNext': 'channelUp',
  'AudioVolumeUp': 'volumeUp',
  'AudioVolumeDown': 'volumeDown',
  'AudioVolumeMute': 'mute',
  'i': 'info',
  'm': 'menu',
  
  // Number keys
  '0': 'number0',
  '1': 'number1',
  '2': 'number2',
  '3': 'number3',
  '4': 'number4',
  '5': 'number5',
  '6': 'number6',
  '7': 'number7',
  '8': 'number8',
  '9': 'number9',
};

// KeyCode mappings for TV compatibility
const KEYCODE_TO_ACTION: Record<number, RemoteAction> = {
  // Standard
  38: 'up',
  40: 'down',
  37: 'left',
  39: 'right',
  13: 'ok',
  32: 'play',
  27: 'back',
  8: 'back',
  
  // Samsung Tizen
  10009: 'back',    // RETURN
  10182: 'back',    // EXIT
  415: 'play',      // PLAY
  19: 'pause',      // PAUSE
  413: 'stop',      // STOP
  412: 'rewind',    // REWIND
  417: 'forward',   // FAST_FORWARD
  427: 'channelUp', // CH_UP
  428: 'channelDown', // CH_DOWN
  447: 'menu',      // MENU
  457: 'info',      // INFO
  403: 'red',       // RED
  404: 'green',     // GREEN
  405: 'yellow',    // YELLOW
  406: 'blue',      // BLUE
  
  // LG webOS
  461: 'back',      // BACK
  1536: 'play',     // PLAY
  
  // Android TV
  4: 'back',        // KEYCODE_BACK
  23: 'ok',         // KEYCODE_DPAD_CENTER
  66: 'ok',         // KEYCODE_ENTER
  85: 'play',       // KEYCODE_MEDIA_PLAY_PAUSE
  126: 'play',      // KEYCODE_MEDIA_PLAY
  127: 'pause',     // KEYCODE_MEDIA_PAUSE
  86: 'stop',       // KEYCODE_MEDIA_STOP
  89: 'rewind',     // KEYCODE_MEDIA_REWIND
  90: 'forward',    // KEYCODE_MEDIA_FAST_FORWARD
  
  // Numbers
  48: 'number0', 49: 'number1', 50: 'number2', 51: 'number3', 52: 'number4',
  53: 'number5', 54: 'number6', 55: 'number7', 56: 'number8', 57: 'number9',
  96: 'number0', 97: 'number1', 98: 'number2', 99: 'number3', 100: 'number4',
  101: 'number5', 102: 'number6', 103: 'number7', 104: 'number8', 105: 'number9',
};

// =============================================================================
// HOOK
// =============================================================================

export function useRemoteInput(options: UseRemoteInputOptions = {}) {
  const {
    enabled = true,
    preventDefault = true,
    debounceMs = 100,
    onUp, onDown, onLeft, onRight,
    onOk, onBack, onPlay, onPause, onPlayPause,
    onStop, onRewind, onForward,
    onChannelUp, onChannelDown,
    onVolumeUp, onVolumeDown, onMute,
    onInfo, onMenu, onNumber, onAnyKey,
  } = options;

  const lastKeyTimeRef = useRef<number>(0);

  const handleAction = useCallback((action: RemoteAction) => {
    // Debounce
    const now = Date.now();
    if (now - lastKeyTimeRef.current < debounceMs) return;
    lastKeyTimeRef.current = now;

    // Notify any key handler
    onAnyKey?.(action);

    // Call specific handler
    switch (action) {
      case 'up': onUp?.(); break;
      case 'down': onDown?.(); break;
      case 'left': onLeft?.(); break;
      case 'right': onRight?.(); break;
      case 'ok': onOk?.(); break;
      case 'back': onBack?.(); break;
      case 'play': 
        onPlay?.(); 
        onPlayPause?.();
        break;
      case 'pause': 
        onPause?.(); 
        onPlayPause?.();
        break;
      case 'stop': onStop?.(); break;
      case 'rewind': onRewind?.(); break;
      case 'forward': onForward?.(); break;
      case 'channelUp': onChannelUp?.(); break;
      case 'channelDown': onChannelDown?.(); break;
      case 'volumeUp': onVolumeUp?.(); break;
      case 'volumeDown': onVolumeDown?.(); break;
      case 'mute': onMute?.(); break;
      case 'info': onInfo?.(); break;
      case 'menu': onMenu?.(); break;
      case 'number0': case 'number1': case 'number2': case 'number3': case 'number4':
      case 'number5': case 'number6': case 'number7': case 'number8': case 'number9':
        onNumber?.(parseInt(action.replace('number', '')));
        break;
    }
  }, [
    debounceMs, onUp, onDown, onLeft, onRight, onOk, onBack,
    onPlay, onPause, onPlayPause, onStop, onRewind, onForward,
    onChannelUp, onChannelDown, onVolumeUp, onVolumeDown, onMute,
    onInfo, onMenu, onNumber, onAnyKey,
  ]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Try key first, then keyCode
      let action = KEY_TO_ACTION[e.key] || KEYCODE_TO_ACTION[e.keyCode];

      if (action) {
        if (preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        handleAction(action);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled, preventDefault, handleAction]);

  return {
    triggerAction: handleAction,
  };
}

export default useRemoteInput;
