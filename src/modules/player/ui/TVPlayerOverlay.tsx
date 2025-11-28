/**
 * ============================================================================
 * TV Player Overlay - HUD de Player Estilo Netflix
 * ============================================================================
 * 
 * Overlay de player para TV com:
 * - Auto-hide inteligente
 * - Controles de navegação remota
 * - Indicadores de status
 * - Progress bar
 * - Info do canal
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RefreshCw,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Settings,
  Info,
  Maximize,
} from 'lucide-react';
import type { EngineState, EngineMetrics } from '../engine/PlayerEngine';

// =============================================================================
// TYPES
// =============================================================================

interface TVPlayerOverlayProps {
  title?: string;
  logo?: string;
  category?: string;
  isVisible: boolean;
  state: EngineState;
  metrics?: EngineMetrics;
  isPaused: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSeek: (delta: number) => void;
  onReload: () => void;
  onBack: () => void;
  onShowChannels?: () => void;
  onShowSettings?: () => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TVPlayerOverlay({
  title,
  logo,
  category,
  isVisible,
  state,
  metrics,
  isPaused,
  isMuted,
  currentTime,
  duration,
  onTogglePlay,
  onToggleMute,
  onSeek,
  onReload,
  onBack,
  onShowChannels,
  onShowSettings,
  className,
}: TVPlayerOverlayProps) {
  const [focusedControl, setFocusedControl] = useState<string>('play');
  
  const controls = [
    { id: 'back', icon: ArrowLeft, label: 'Voltar', action: onBack },
    { id: 'rewind', icon: SkipBack, label: '-10s', action: () => onSeek(-10) },
    { id: 'play', icon: isPaused ? Play : Pause, label: isPaused ? 'Play' : 'Pausar', action: onTogglePlay },
    { id: 'forward', icon: SkipForward, label: '+10s', action: () => onSeek(10) },
    { id: 'mute', icon: isMuted ? VolumeX : Volume2, label: isMuted ? 'Ativar Som' : 'Mudo', action: onToggleMute },
    { id: 'reload', icon: RefreshCw, label: 'Recarregar', action: onReload },
  ];

  // Navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = controls.findIndex(c => c.id === focusedControl);
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            setFocusedControl(controls[currentIndex - 1].id);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < controls.length - 1) {
            setFocusedControl(controls[currentIndex + 1].id);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const control = controls.find(c => c.id === focusedControl);
          control?.action();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, focusedControl, controls]);

  // Format time helper
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col justify-between',
        'bg-gradient-to-t from-black/90 via-transparent to-black/70',
        'transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
    >
      {/* Top Bar - Channel Info */}
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4">
          {/* Back button */}
          <button
            onClick={onBack}
            className={cn(
              'p-3 rounded-full transition-all',
              focusedControl === 'back'
                ? 'bg-primary text-primary-foreground scale-110'
                : 'bg-background/20 text-foreground hover:bg-background/40'
            )}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          {/* Logo */}
          {logo && (
            <img
              src={logo}
              alt=""
              className="w-14 h-14 rounded-lg object-contain bg-background/20"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}

          {/* Title & Category */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title || 'Canal'}</h1>
            {category && (
              <p className="text-sm text-muted-foreground">{category}</p>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/20 rounded-full">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-medium text-destructive">AO VIVO</span>
          </div>

          {/* Quality badge */}
          {metrics && metrics.currentLevel >= 0 && (
            <div className="px-3 py-1.5 bg-background/20 rounded-full">
              <span className="text-sm font-medium text-foreground">
                {metrics.levels > 1 ? 'HD' : 'SD'}
              </span>
            </div>
          )}

          {/* Settings button */}
          {onShowSettings && (
            <button
              onClick={onShowSettings}
              className="p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
            >
              <Settings className="w-5 h-5 text-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Center - Loading/Pause indicator */}
      {(state === 'loading' || state === 'buffering') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-16 h-16 text-primary animate-spin" />
            <span className="text-muted-foreground">
              {state === 'loading' ? 'Carregando...' : 'Buffering...'}
            </span>
          </div>
        </div>
      )}

      {isPaused && state !== 'loading' && state !== 'buffering' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-24 rounded-full bg-background/30 flex items-center justify-center">
            <Play className="w-12 h-12 text-foreground ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Bar - Controls */}
      <div className="p-6 space-y-4">
        {/* Progress bar (for VOD) */}
        {duration > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-4">
          {controls.map((control) => {
            const Icon = control.icon;
            const isFocused = focusedControl === control.id;
            
            return (
              <button
                key={control.id}
                onClick={control.action}
                className={cn(
                  'p-4 rounded-full transition-all duration-200',
                  control.id === 'play' && 'p-6',
                  isFocused
                    ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                    : 'bg-background/20 text-foreground hover:bg-background/40'
                )}
                title={control.label}
              >
                <Icon className={cn(
                  'w-6 h-6',
                  control.id === 'play' && 'w-8 h-8'
                )} />
              </button>
            );
          })}
        </div>

        {/* Keyboard hints */}
        <div className="flex justify-center gap-8 text-xs text-muted-foreground/60">
          <span>←→ Navegar</span>
          <span>OK Selecionar</span>
          <span>BACK Voltar</span>
        </div>

        {/* Metrics (debug) */}
        {metrics && (
          <div className="flex justify-center gap-4 text-xs text-muted-foreground/40">
            <span>Buffer: {metrics.bufferLength.toFixed(1)}s</span>
            <span>Stalls: {metrics.stalls}</span>
            <span>Startup: {metrics.startupTime.toFixed(0)}ms</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default TVPlayerOverlay;
