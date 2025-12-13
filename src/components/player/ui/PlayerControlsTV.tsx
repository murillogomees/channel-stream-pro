/**
 * PlayerControlsTV - Controles otimizados para TV/Remote
 * 
 * @features
 * - Botões grandes para TV
 * - Navegação por controle remoto (setas + OK)
 * - Foco visual claro
 * - Modo fullscreen por padrão
 * - Evita interações hover
 */

import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, ChevronUp, ChevronDown,
  ArrowLeft, List, Heart
} from 'lucide-react';

interface PlayerControlsTVProps {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime?: number;
  duration?: number;
  isLive?: boolean;
  isFavorite?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onMute: () => void;
  onUnmute: () => void;
  onVolumeChange: (volume: number) => void;
  onFullscreen: () => void;
  onExitFullscreen: () => void;
  onSeek?: (seconds: number) => void;
  onBack?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onToggleFavorite?: () => void;
  onShowChannelList?: () => void;
  onShowSettings?: () => void;
  visible?: boolean;
  className?: string;
}

const FOCUS_BUTTONS = [
  'back', 'play', 'mute', 'fullscreen', 'channel-up', 'channel-down', 
  'favorite', 'channels', 'settings'
] as const;

type FocusButton = typeof FOCUS_BUTTONS[number];

export const PlayerControlsTV = memo(function PlayerControlsTV({
  isPlaying,
  isMuted,
  isFullscreen,
  volume,
  currentTime = 0,
  duration = 0,
  isLive = true,
  isFavorite = false,
  onPlay,
  onPause,
  onMute,
  onUnmute,
  onVolumeChange,
  onFullscreen,
  onExitFullscreen,
  onSeek,
  onBack,
  onChannelUp,
  onChannelDown,
  onToggleFavorite,
  onShowChannelList,
  onShowSettings,
  visible = true,
  className,
}: PlayerControlsTVProps) {
  const [focusedButton, setFocusedButton] = useState<FocusButton>('play');
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigate between buttons with arrow keys
  const navigate = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    const currentIndex = FOCUS_BUTTONS.indexOf(focusedButton);
    let newIndex = currentIndex;

    if (direction === 'left') {
      newIndex = Math.max(0, currentIndex - 1);
    } else if (direction === 'right') {
      newIndex = Math.min(FOCUS_BUTTONS.length - 1, currentIndex + 1);
    } else if (direction === 'up') {
      // Volume up or channel up
      if (focusedButton === 'mute') {
        onVolumeChange(Math.min(1, volume + 0.1));
      } else if (focusedButton === 'channel-up' || focusedButton === 'channel-down') {
        onChannelUp?.();
      }
      return;
    } else if (direction === 'down') {
      // Volume down or channel down
      if (focusedButton === 'mute') {
        onVolumeChange(Math.max(0, volume - 0.1));
      } else if (focusedButton === 'channel-up' || focusedButton === 'channel-down') {
        onChannelDown?.();
      }
      return;
    }

    setFocusedButton(FOCUS_BUTTONS[newIndex]);
  }, [focusedButton, volume, onVolumeChange, onChannelUp, onChannelDown]);

  // Execute focused button action
  const executeAction = useCallback(() => {
    switch (focusedButton) {
      case 'back':
        onBack?.();
        break;
      case 'play':
        isPlaying ? onPause() : onPlay();
        break;
      case 'mute':
        isMuted ? onUnmute() : onMute();
        break;
      case 'fullscreen':
        isFullscreen ? onExitFullscreen() : onFullscreen();
        break;
      case 'channel-up':
        onChannelUp?.();
        break;
      case 'channel-down':
        onChannelDown?.();
        break;
      case 'favorite':
        onToggleFavorite?.();
        break;
      case 'channels':
        onShowChannelList?.();
        break;
      case 'settings':
        onShowSettings?.();
        break;
    }
  }, [
    focusedButton, isPlaying, isMuted, isFullscreen,
    onPlay, onPause, onMute, onUnmute, onFullscreen, onExitFullscreen,
    onBack, onChannelUp, onChannelDown, onToggleFavorite, onShowChannelList, onShowSettings
  ]);

  // Keyboard handler for TV remote
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigate('right');
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigate('down');
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          executeAction();
          break;
        case 'Escape':
          e.preventDefault();
          onBack?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, executeAction, onBack]);

  const buttonClass = (id: FocusButton) => cn(
    'flex items-center justify-center rounded-xl transition-all duration-200',
    'bg-white/10 backdrop-blur-sm text-white',
    'focus:outline-none focus:ring-0',
    // TV-sized buttons
    'w-14 h-14 sm:w-16 sm:h-16',
    // Focus state - clear visual indicator
    focusedButton === id && 'bg-primary text-primary-foreground scale-110 ring-4 ring-primary/50',
    // Non-focused state
    focusedButton !== id && 'opacity-70'
  );

  const iconClass = 'w-7 h-7 sm:w-8 sm:h-8';

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between">
        {/* Back Button */}
        <button
          className={buttonClass('back')}
          onClick={() => { setFocusedButton('back'); onBack?.(); }}
          onFocus={() => setFocusedButton('back')}
        >
          <ArrowLeft className={iconClass} />
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            className={buttonClass('favorite')}
            onClick={() => { setFocusedButton('favorite'); onToggleFavorite?.(); }}
            onFocus={() => setFocusedButton('favorite')}
          >
            <Heart className={cn(iconClass, isFavorite && 'fill-current text-destructive')} />
          </button>
          <button
            className={buttonClass('channels')}
            onClick={() => { setFocusedButton('channels'); onShowChannelList?.(); }}
            onFocus={() => setFocusedButton('channels')}
          >
            <List className={iconClass} />
          </button>
          <button
            className={buttonClass('settings')}
            onClick={() => { setFocusedButton('settings'); onShowSettings?.(); }}
            onFocus={() => setFocusedButton('settings')}
          >
            <Settings className={iconClass} />
          </button>
        </div>
      </div>

      {/* Center Controls */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-6">
          {/* Seek Back (for VOD) */}
          {!isLive && (
            <button
              className={cn(buttonClass('play'), 'opacity-60')}
              onClick={() => onSeek?.(-10)}
            >
              <SkipBack className={iconClass} />
            </button>
          )}

          {/* Play/Pause - Main Action */}
          <button
            className={cn(
              buttonClass('play'),
              'w-20 h-20 sm:w-24 sm:h-24' // Larger center button
            )}
            onClick={() => { setFocusedButton('play'); isPlaying ? onPause() : onPlay(); }}
            onFocus={() => setFocusedButton('play')}
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 sm:w-12 sm:h-12" />
            ) : (
              <Play className="w-10 h-10 sm:w-12 sm:h-12 ml-1" />
            )}
          </button>

          {/* Seek Forward (for VOD) */}
          {!isLive && (
            <button
              className={cn(buttonClass('play'), 'opacity-60')}
              onClick={() => onSeek?.(10)}
            >
              <SkipForward className={iconClass} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          {/* Left: Channel Navigation */}
          <div className="flex items-center gap-3">
            <button
              className={buttonClass('channel-down')}
              onClick={() => { setFocusedButton('channel-down'); onChannelDown?.(); }}
              onFocus={() => setFocusedButton('channel-down')}
            >
              <ChevronDown className={iconClass} />
            </button>
            <button
              className={buttonClass('channel-up')}
              onClick={() => { setFocusedButton('channel-up'); onChannelUp?.(); }}
              onFocus={() => setFocusedButton('channel-up')}
            >
              <ChevronUp className={iconClass} />
            </button>
          </div>

          {/* Center: Live/Time indicator */}
          <div className="text-white/80 text-sm font-medium">
            {isLive ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                AO VIVO
              </span>
            ) : (
              <span>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            )}
          </div>

          {/* Right: Volume & Fullscreen */}
          <div className="flex items-center gap-3">
            <button
              className={buttonClass('mute')}
              onClick={() => { setFocusedButton('mute'); isMuted ? onUnmute() : onMute(); }}
              onFocus={() => setFocusedButton('mute')}
            >
              {isMuted ? (
                <VolumeX className={iconClass} />
              ) : (
                <Volume2 className={iconClass} />
              )}
            </button>
            <button
              className={buttonClass('fullscreen')}
              onClick={() => { 
                setFocusedButton('fullscreen'); 
                isFullscreen ? onExitFullscreen() : onFullscreen(); 
              }}
              onFocus={() => setFocusedButton('fullscreen')}
            >
              {isFullscreen ? (
                <Minimize className={iconClass} />
              ) : (
                <Maximize className={iconClass} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default PlayerControlsTV;
