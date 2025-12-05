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

  const cleanupRef = useRef<(() => void)[]>([]);

  const handleAction = useCallback((action: RemoteAction) => {
    switch (action) {
      case 'play':
        onPlay?.();
        break;
      case 'pause':
        onPause?.();
        break;
      case 'togglePlay':
        onTogglePlay?.();
        break;
      case 'forward':
        onForward?.(seekAmount);
        break;
      case 'rewind':
        onRewind?.(seekAmount);
        break;
      case 'volumeUp':
        onVolumeUp?.();
        break;
      case 'volumeDown':
        onVolumeDown?.();
        break;
      case 'mute':
        onMute?.();
        break;
      case 'fullscreen':
        onFullscreen?.();
        break;
      case 'channelUp':
        onChannelUp?.();
        break;
      case 'channelDown':
        onChannelDown?.();
        break;
      case 'back':
        onBack?.();
        break;
      case 'info':
        onInfo?.();
        break;
      case 'guide':
        onGuide?.();
        break;
      case 'menu':
        onMenu?.();
        break;
    }
  }, [
    onPlay, onPause, onTogglePlay, onForward, onRewind,
    onVolumeUp, onVolumeDown, onMute, onFullscreen,
    onChannelUp, onChannelDown, onBack, onInfo, onGuide, onMenu,
    seekAmount
  ]);

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

    // Direct channel input
    if (onChannelDirect) {
      const unsub = remoteControl.onChannelInput(onChannelDirect);
      cleanupRef.current.push(unsub);
    }

    return () => {
      cleanupRef.current.forEach(unsub => unsub());
      cleanupRef.current = [];
      remoteControl.destroy();
    };
  }, [enabled, handleAction, onChannelDirect]);

  return {
    seekAmount,
  };
}
