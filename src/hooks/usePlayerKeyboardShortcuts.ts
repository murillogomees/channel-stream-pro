/**
 * usePlayerKeyboardShortcuts - Keyboard Shortcuts for Player
 * 
 * Provides keyboard controls: volume, mute, fullscreen, channel navigation.
 */

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcutsConfig {
  volumeStep?: number;
  seekStep?: number;
  enabled?: boolean;
}

interface KeyboardShortcutsCallbacks {
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMuteToggle?: () => void;
  onFullscreenToggle?: () => void;
  onPlayPauseToggle?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
  onPiPToggle?: () => void;
  onEscape?: () => void;
}

const DEFAULT_CONFIG: KeyboardShortcutsConfig = {
  volumeStep: 0.1,
  seekStep: 10,
  enabled: true,
};

export function usePlayerKeyboardShortcuts(
  callbacks: KeyboardShortcutsCallbacks,
  config: KeyboardShortcutsConfig = {}
) {
  const { enabled = true } = { ...DEFAULT_CONFIG, ...config };
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const cb = callbacksRef.current;
    let handled = true;

    switch (event.key.toLowerCase()) {
      // Volume controls
      case 'arrowup':
        if (!event.shiftKey) {
          cb.onVolumeUp?.();
        }
        break;
      case 'arrowdown':
        if (!event.shiftKey) {
          cb.onVolumeDown?.();
        }
        break;
      case 'm':
        cb.onMuteToggle?.();
        break;

      // Playback controls
      case ' ' :
      case 'k':
        cb.onPlayPauseToggle?.();
        break;

      // Seek controls
      case 'arrowleft':
      case 'j':
        cb.onSeekBackward?.();
        break;
      case 'arrowright':
      case 'l':
        cb.onSeekForward?.();
        break;

      // Channel navigation
      case 'pageup':
      case 'w':
        cb.onChannelUp?.();
        break;
      case 'pagedown':
      case 's':
        cb.onChannelDown?.();
        break;

      // Fullscreen
      case 'f':
        cb.onFullscreenToggle?.();
        break;

      // Picture-in-Picture
      case 'p':
        if (event.shiftKey) {
          cb.onPiPToggle?.();
        } else {
          handled = false;
        }
        break;

      // Escape
      case 'escape':
        cb.onEscape?.();
        break;

      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: [
      { key: '↑/↓', description: 'Volume' },
      { key: 'M', description: 'Mudo' },
      { key: 'Space/K', description: 'Play/Pause' },
      { key: '←/→', description: 'Seek' },
      { key: 'PgUp/W', description: 'Canal +' },
      { key: 'PgDn/S', description: 'Canal -' },
      { key: 'F', description: 'Fullscreen' },
      { key: 'Shift+P', description: 'PiP' },
      { key: 'Esc', description: 'Sair' },
    ],
  };
}

export default usePlayerKeyboardShortcuts;
