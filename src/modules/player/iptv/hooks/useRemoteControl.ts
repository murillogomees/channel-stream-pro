/**
 * Remote Control React Hook
 */

import { useEffect, useCallback, useRef } from 'react';
import { remoteControl, type RemoteAction } from '../services/remoteControl';

interface UseRemoteControlOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onTogglePlay?: () => void;
  onForward?: (seconds: number) => void;
  onRewind?: (seconds: number) => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onFullscreen?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onChannelDirect?: (num: number) => void;
  onBack?: () => void;
  onInfo?: () => void;
  onGuide?: () => void;
  onMenu?: () => void;
  seekAmount?: number;
  enabled?: boolean;
}

export function useRemoteControl(options: UseRemoteControlOptions = {}) {
  const {
    onPlay,
    onPause,
    onTogglePlay,
    onForward,
    onRewind,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onFullscreen,
    onChannelUp,
    onChannelDown,
    onChannelDirect,
    onBack,
    onInfo,
    onGuide,
    onMenu,
    seekAmount = 10,
    enabled = true,
  } = options;

  // Store callbacks in refs to avoid re-initializing on every render
  const callbacksRef = useRef({
    onPlay,
    onPause,
    onTogglePlay,
    onForward,
    onRewind,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onFullscreen,
    onChannelUp,
    onChannelDown,
    onChannelDirect,
    onBack,
    onInfo,
    onGuide,
    onMenu,
  });

  const seekAmountRef = useRef(seekAmount);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Update refs when callbacks change (without triggering effect)
  callbacksRef.current = {
    onPlay,
    onPause,
    onTogglePlay,
    onForward,
    onRewind,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onFullscreen,
    onChannelUp,
    onChannelDown,
    onChannelDirect,
    onBack,
    onInfo,
    onGuide,
    onMenu,
  };
  seekAmountRef.current = seekAmount;

  // Stable handler that reads from refs
  const handleAction = useCallback((action: RemoteAction) => {
    const cb = callbacksRef.current;
    const seek = seekAmountRef.current;
    
    switch (action) {
      case 'play':
        cb.onPlay?.();
        break;
      case 'pause':
        cb.onPause?.();
        break;
      case 'togglePlay':
        cb.onTogglePlay?.();
        break;
      case 'forward':
        cb.onForward?.(seek);
        break;
      case 'rewind':
        cb.onRewind?.(seek);
        break;
      case 'volumeUp':
        cb.onVolumeUp?.();
        break;
      case 'volumeDown':
        cb.onVolumeDown?.();
        break;
      case 'mute':
        cb.onMute?.();
        break;
      case 'fullscreen':
        cb.onFullscreen?.();
        break;
      case 'channelUp':
        cb.onChannelUp?.();
        break;
      case 'channelDown':
        cb.onChannelDown?.();
        break;
      case 'back':
        cb.onBack?.();
        break;
      case 'info':
        cb.onInfo?.();
        break;
      case 'guide':
        cb.onGuide?.();
        break;
      case 'menu':
        cb.onMenu?.();
        break;
    }
  }, []); // No deps - reads from refs

  // Initialize once when enabled changes
  useEffect(() => {
    if (!enabled) return;

    remoteControl.initialize();

    // Subscribe to all actions
    const actions: RemoteAction[] = [
      'play', 'pause', 'togglePlay', 'forward', 'rewind',
      'volumeUp', 'volumeDown', 'mute', 'fullscreen',
      'channelUp', 'channelDown', 'back', 'info', 'guide', 'menu'
    ];

    actions.forEach(action => {
      const unsub = remoteControl.on(action, handleAction);
      cleanupRef.current.push(unsub);
    });

    // Direct channel input - stable callback that reads from ref
    const handleChannelDirect = (num: number) => {
      callbacksRef.current.onChannelDirect?.(num);
    };
    const unsub = remoteControl.onChannelInput(handleChannelDirect);
    cleanupRef.current.push(unsub);

    return () => {
      cleanupRef.current.forEach(unsub => unsub());
      cleanupRef.current = [];
      remoteControl.destroy();
    };
  }, [enabled, handleAction]); // handleAction is stable now

  return {
    seekAmount,
  };
}
