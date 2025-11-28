/**
 * ============================================================================
 * PlayerOverlay - Overlay do Player IPTV
 * ============================================================================
 * 
 * Overlay com informações do canal e controles:
 * - Auto-hide após inatividade
 * - Info do canal atual
 * - Controles de reprodução
 * - Barra de progresso
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Info, Heart, ArrowLeft, Settings, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Channel } from '../services/StreamService';

// =============================================================================
// TYPES
// =============================================================================

interface PlayerOverlayProps {
  /** Canal atual */
  channel: Channel | null;
  /** Estado de reprodução */
  isPlaying: boolean;
  /** Estado de buffer */
  isBuffering: boolean;
  /** Estado mudo */
  isMuted: boolean;
  /** Tempo atual (segundos) */
  currentTime: number;
  /** Duração total (segundos) */
  duration: number;
  /** Volume (0-1) */
  volume: number;
  /** Overlay visível */
  visible: boolean;
  /** Erro atual */
  error: string | null;
  /** É favorito */
  isFavorite?: boolean;
  /** Canal anterior disponível */
  hasPrevious?: boolean;
  /** Próximo canal disponível */
  hasNext?: boolean;
  /** Handlers */
  onTogglePlay?: () => void;
  onToggleMute?: () => void;
  onSeek?: (time: number) => void;
  onSeekRelative?: (delta: number) => void;
  onVolumeChange?: (volume: number) => void;
  onToggleFavorite?: () => void;
  onPreviousChannel?: () => void;
  onNextChannel?: () => void;
  onBack?: () => void;
  onShowInfo?: () => void;
  onShowSettings?: () => void;
  onToggleFullscreen?: () => void;
  onRetry?: () => void;
  /** Auto-hide timeout (ms) */
  autoHideMs?: number;
  /** Callback ao mostrar/esconder */
  onVisibilityChange?: (visible: boolean) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PlayerOverlay({
  channel,
  isPlaying,
  isBuffering,
  isMuted,
  currentTime,
  duration,
  volume,
  visible,
  error,
  isFavorite = false,
  hasPrevious = false,
  hasNext = false,
  onTogglePlay,
  onToggleMute,
  onSeek,
  onSeekRelative,
  onVolumeChange,
  onToggleFavorite,
  onPreviousChannel,
  onNextChannel,
  onBack,
  onShowInfo,
  onShowSettings,
  onToggleFullscreen,
  onRetry,
  autoHideMs = 5000,
  onVisibilityChange,
}: PlayerOverlayProps) {
  const [localVisible, setLocalVisible] = useState(visible);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLiveStream = !duration || !isFinite(duration) || duration === Infinity;

  // Sync with external visibility
  useEffect(() => {
    setLocalVisible(visible);
  }, [visible]);

  // Reset hide timer
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setLocalVisible(true);
    onVisibilityChange?.(true);

    hideTimerRef.current = setTimeout(() => {
      setLocalVisible(false);
      onVisibilityChange?.(false);
    }, autoHideMs);
  }, [autoHideMs, onVisibilityChange]);

  // Show on activity
  const handleActivity = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Handle progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isLiveStream || !onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  }, [duration, isLiveStream, onSeek]);

  if (!localVisible && !error && !isBuffering) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-300',
        localVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onMouseMove={handleActivity}
      onClick={handleActivity}
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          {/* Back + Info */}
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            
            {channel && (
              <div className="flex items-center gap-3">
                {channel.tvg_logo && (
                  <img
                    src={channel.tvg_logo}
                    alt=""
                    className="w-10 h-10 rounded object-contain bg-background/20"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-foreground line-clamp-1">
                    {channel.name}
                  </h2>
                  {channel.category_name && (
                    <p className="text-sm text-muted-foreground">
                      {channel.category_name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className={cn(
                  'tv-button p-2 rounded-full transition-colors',
                  isFavorite 
                    ? 'bg-red-500/80 text-white' 
                    : 'bg-background/20 hover:bg-background/40'
                )}
              >
                <Heart className={cn('w-5 h-5', isFavorite && 'fill-current')} />
              </button>
            )}

            {onShowInfo && (
              <button
                onClick={onShowInfo}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                <Info className="w-5 h-5" />
              </button>
            )}

            {onShowSettings && (
              <button
                onClick={onShowSettings}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                <Maximize className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center - Play/Pause + Loading */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isBuffering ? (
          <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        ) : error ? (
          <div className="text-center p-6 bg-background/80 rounded-xl pointer-events-auto">
            <p className="text-destructive font-medium mb-4">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Tentar Novamente
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        {/* Progress Bar (VOD only) */}
        {!isLiveStream && (
          <div
            className="mb-4 h-1 bg-muted/50 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-primary rounded-full relative group-hover:h-1.5 transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Left: Channel nav + Time */}
          <div className="flex items-center gap-4">
            {hasPrevious && onPreviousChannel && (
              <button
                onClick={onPreviousChannel}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onTogglePlay}
              className="tv-button p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            {hasNext && onNextChannel && (
              <button
                onClick={onNextChannel}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}

            {/* Time */}
            <div className="text-sm text-muted-foreground">
              {isLiveStream ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  AO VIVO
                </span>
              ) : (
                <span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          {/* Right: Volume + Seek hints */}
          <div className="flex items-center gap-4">
            {/* Seek hints */}
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
              <span>◀ -10s</span>
              <span>+10s ▶</span>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleMute}
                className="tv-button p-2 rounded-full bg-background/20 hover:bg-background/40 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              {onVolumeChange && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-muted/50 rounded-full appearance-none cursor-pointer hidden sm:block"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerOverlay;
