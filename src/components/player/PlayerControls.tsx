/**
 * PlayerControls - Optimized player controls layout
 * 
 * Clean, responsive layout for all player controls
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, RefreshCw,
  ArrowLeft, Activity, SkipBack, SkipForward, Cast
} from 'lucide-react';
import { SeekBar } from './SeekBar';
import { QualitySelector } from './QualitySelector';
import { QualityBadge } from './QualityBadge';
import { QualityLevel, ABRStats, ABRMode } from '@/services/abrService';

interface ThumbnailData {
  time: number;
  dataUrl: string;
}

interface PlayerControlsProps {
  // State
  paused: boolean;
  muted: boolean;
  fullscreen: boolean;
  loading: boolean;
  
  // Time
  currentTime: number;
  duration: number;
  buffered: number;
  
  // Channel info
  title?: string;
  logo?: string;
  isLive?: boolean;
  
  // Quality
  qualityLevels?: QualityLevel[];
  currentLevel?: QualityLevel | null;
  qualityMode?: ABRMode;
  qualityStats?: ABRStats | null;
  showQualitySelector?: boolean;
  
  // Thumbnail preview
  getThumbnailAtTime?: (time: number) => ThumbnailData | null;
  
  // Callbacks
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onReload: () => void;
  onBack?: () => void;
  onSeek: (time: number) => void;
  onSkip: (delta: number) => void;
  onQualitySelect?: (level: number) => void;
  onToggleStats?: () => void;
  onCast?: () => void;
  
  className?: string;
}

export const PlayerControls = memo(function PlayerControls({
  paused,
  muted,
  fullscreen,
  loading,
  currentTime,
  duration,
  buffered,
  title,
  logo,
  isLive = false,
  qualityLevels,
  currentLevel,
  qualityMode,
  qualityStats,
  showQualitySelector = false,
  getThumbnailAtTime,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onReload,
  onBack,
  onSeek,
  onSkip,
  onQualitySelect,
  onToggleStats,
  onCast,
  className,
}: PlayerControlsProps) {
  const hasQuality = showQualitySelector && qualityLevels && qualityLevels.length > 1;
  const isVOD = !isLive && duration > 0 && isFinite(duration);

  return (
    <div className={cn('flex flex-col h-full justify-between', className)}>
      {/* ===== TOP BAR ===== */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="flex-shrink-0 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>
          )}
          
          {logo && (
            <img
              src={logo}
              alt=""
              className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded object-contain bg-black/40"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          
          {title && (
            <span className="text-white text-sm sm:text-lg font-medium truncate">
              {title}
            </span>
          )}
        </div>
        
        {/* Right: Utilities */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Live indicator */}
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-600/90 rounded text-xs font-medium text-white">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              AO VIVO
            </span>
          )}
          
          {/* Stats button */}
          {onToggleStats && (
            <button
              onClick={onToggleStats}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label="Estatísticas"
            >
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          )}
          
          {/* Cast button */}
          {onCast && (
            <button
              onClick={onCast}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label="Cast"
            >
              <Cast className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          )}
        </div>
      </div>
      
      {/* ===== CENTER: Pause indicator ===== */}
      <div className="flex-1 flex items-center justify-center">
        {paused && !loading && (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/40 flex items-center justify-center">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
          </div>
        )}
      </div>
      
      {/* ===== BOTTOM CONTROLS ===== */}
      <div className="p-3 sm:p-4 space-y-3">
        {/* Seek bar (VOD only) */}
        {isVOD && (
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            onSeek={onSeek}
            getThumbnailAtTime={getThumbnailAtTime}
          />
        )}
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Skip back (VOD) */}
            {isVOD && (
              <button
                onClick={() => onSkip(-10)}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                aria-label="-10s"
              >
                <SkipBack className="w-5 h-5 text-white" />
              </button>
            )}
            
            {/* Play/Pause */}
            <button
              onClick={onTogglePlay}
              className="p-2.5 sm:p-3 rounded-full bg-primary hover:bg-primary/90 transition-colors"
              aria-label={paused ? 'Play' : 'Pause'}
            >
              {paused ? (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground ml-0.5" />
              ) : (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
              )}
            </button>
            
            {/* Skip forward (VOD) */}
            {isVOD && (
              <button
                onClick={() => onSkip(10)}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                aria-label="+10s"
              >
                <SkipForward className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
          
          {/* Center: Quality */}
          <div className="flex items-center gap-2">
            {hasQuality && onQualitySelect ? (
              <div className="flex items-center gap-2">
                <QualitySelector
                  levels={qualityLevels}
                  currentLevel={currentLevel}
                  mode={qualityMode}
                  stats={qualityStats}
                  onSelectLevel={onQualitySelect}
                />
                {currentLevel && !currentLevel.isAuto && (
                  <QualityBadge
                    height={currentLevel.height}
                    isAuto={qualityMode === 'auto'}
                    size="sm"
                  />
                )}
              </div>
            ) : isLive ? null : (
              <QualityBadge height={1080} isAuto size="sm" />
            )}
          </div>
          
          {/* Right controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mute */}
            <button
              onClick={onToggleMute}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
            
            {/* Reload */}
            <button
              onClick={onReload}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label="Recarregar"
            >
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
            
            {/* Fullscreen */}
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {fullscreen ? (
                <Minimize className="w-5 h-5 text-white" />
              ) : (
                <Maximize className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PlayerControls;
