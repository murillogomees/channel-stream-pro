/**
 * IPTVPlayerWhiteLabelV2 - Enterprise White Label Player
 * 
 * Player profissional com:
 * - UI/UX premium para TV, mobile, desktop
 * - Branding customizável
 * - Loading elegante
 * - Overlay de erro amigável
 * - Navegação por controle remoto
 * - Responsivo
 */

import React, { useEffect, useCallback, useState, memo } from 'react';
import { useIPTVPlayerV2 } from '@/hooks/useIPTVPlayerV2';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// =============================================================================
// TYPES
// =============================================================================
interface BrandConfig {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

interface IPTVPlayerWhiteLabelV2Props {
  url: string;
  branding?: BrandConfig;
  channelName?: string;
  channelLogo?: string;
  category?: string;
  isLive?: boolean;
  autoPlay?: boolean;
  lowLatency?: boolean;
  showControls?: boolean;
  controlsTimeout?: number;
  onBack?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
  className?: string;
}

// =============================================================================
// LOADING OVERLAY
// =============================================================================
const LoadingOverlay = memo(({ message }: { message: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
    <p className="text-white text-lg">{message}</p>
  </div>
));
LoadingOverlay.displayName = 'LoadingOverlay';

// =============================================================================
// RECOVERING OVERLAY
// =============================================================================
const RecoveringOverlay = memo(({ attempt, maxAttempts }: { attempt: number; maxAttempts: number }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
    <WifiOff className="h-12 w-12 text-yellow-500 mb-4 animate-pulse" />
    <p className="text-white text-lg mb-2">Reconectando...</p>
    <p className="text-white/60 text-sm">Tentativa {attempt} de {maxAttempts}</p>
    <div className="flex gap-1 mt-4">
      {Array.from({ length: maxAttempts }).map((_, i) => (
        <div 
          key={i}
          className={cn(
            "w-2 h-2 rounded-full",
            i < attempt ? "bg-yellow-500" : "bg-white/30"
          )}
        />
      ))}
    </div>
  </div>
));
RecoveringOverlay.displayName = 'RecoveringOverlay';

// =============================================================================
// ERROR OVERLAY
// =============================================================================
const ErrorOverlay = memo(({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
    <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
    <p className="text-white text-xl font-semibold mb-2">Erro de Reprodução</p>
    <p className="text-white/70 text-center max-w-md mb-6 px-4">{message}</p>
    <Button 
      onClick={onRetry}
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className="h-4 w-4" />
      Tentar Novamente
    </Button>
  </div>
));
ErrorOverlay.displayName = 'ErrorOverlay';

// =============================================================================
// CHANNEL INFO
// =============================================================================
const ChannelInfo = memo(({ 
  name, 
  logo, 
  category, 
  isLive 
}: { 
  name?: string; 
  logo?: string; 
  category?: string;
  isLive?: boolean;
}) => (
  <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
    {logo && (
      <img 
        src={logo} 
        alt={name || 'Channel'} 
        className="h-10 w-10 rounded-lg object-contain bg-black/50 p-1"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    )}
    <div className="flex flex-col">
      {name && (
        <span className="text-white font-semibold text-shadow-lg">{name}</span>
      )}
      <div className="flex items-center gap-2">
        {isLive && (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            AO VIVO
          </span>
        )}
        {category && (
          <span className="text-white/60 text-xs">{category}</span>
        )}
      </div>
    </div>
  </div>
));
ChannelInfo.displayName = 'ChannelInfo';

// =============================================================================
// PLAYER CONTROLS
// =============================================================================
const PlayerControls = memo(({
  isPlaying,
  isMuted,
  volume,
  isFullscreen,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onBack,
}: {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  onToggleFullscreen: () => void;
  onBack?: () => void;
}) => (
  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-10">
    <div className="flex items-center justify-between">
      {/* Left controls */}
      <div className="flex items-center gap-2">
        {onBack && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onTogglePlay}
          className="text-white hover:bg-white/20"
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </Button>
      </div>

      {/* Center - Volume */}
      <div className="flex items-center gap-2 flex-1 max-w-xs mx-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggleMute}
          className="text-white hover:bg-white/20"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>
        
        <Slider
          value={[isMuted ? 0 : volume * 100]}
          onValueChange={([v]) => onVolumeChange(v / 100)}
          max={100}
          step={1}
          className="flex-1"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggleFullscreen}
          className="text-white hover:bg-white/20"
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  </div>
));
PlayerControls.displayName = 'PlayerControls';

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export const IPTVPlayerWhiteLabelV2 = memo(function IPTVPlayerWhiteLabelV2({
  url,
  branding,
  channelName,
  channelLogo,
  category,
  isLive = true,
  autoPlay = true,
  lowLatency = true,
  showControls = true,
  controlsTimeout = 3000,
  onBack,
  onError,
  onReady,
  className,
}: IPTVPlayerWhiteLabelV2Props) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout>();

  const player = useIPTVPlayerV2({
    autoPlay,
    lowLatency,
    onReady,
    onError: (err) => onError?.(err.message),
  });

  // Load source on mount
  useEffect(() => {
    if (url) {
      player.loadSource(url);
    }
    
    return () => {
      player.destroy();
    };
  }, [url]);

  // Auto-hide controls
  const showControlsHandler = useCallback(() => {
    setControlsVisible(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      if (player.isPlaying) {
        setControlsVisible(false);
      }
    }, controlsTimeout);
  }, [controlsTimeout, player.isPlaying]);

  // Initial controls visibility
  useEffect(() => {
    showControlsHandler();
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [showControlsHandler]);

  // Click handler
  const handleClick = useCallback(() => {
    if (controlsVisible) {
      player.togglePlay();
    } else {
      showControlsHandler();
    }
  }, [controlsVisible, player, showControlsHandler]);

  // Keyboard navigation (TV remote support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          player.togglePlay();
          break;
        case 'ArrowUp':
          e.preventDefault();
          player.setVolume(Math.min(1, player.volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          player.setVolume(Math.max(0, player.volume - 0.1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          player.seek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          player.seek(10);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          player.toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          player.toggleFullscreen();
          break;
        case 'Escape':
          e.preventDefault();
          if (player.isFullscreen) {
            player.exitFullscreen();
          } else {
            onBack?.();
          }
          break;
        case 'Backspace':
          e.preventDefault();
          onBack?.();
          break;
      }
      
      showControlsHandler();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player, onBack, showControlsHandler]);

  // Custom CSS variables for branding
  const brandingStyle = branding ? {
    '--player-primary': branding.primaryColor,
    '--player-secondary': branding.secondaryColor,
    '--player-accent': branding.accentColor,
    fontFamily: branding.fontFamily,
  } as React.CSSProperties : undefined;

  return (
    <div 
      ref={player.containerRef}
      className={cn(
        "relative w-full h-full bg-black overflow-hidden select-none",
        className
      )}
      style={brandingStyle}
      onClick={handleClick}
      onMouseMove={showControlsHandler}
      onTouchStart={showControlsHandler}
    >
      {/* Video Element */}
      <video
        ref={player.videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay={autoPlay}
        muted={false}
      />

      {/* Loading State */}
      {player.state === 'loading' && (
        <LoadingOverlay message="Carregando stream..." />
      )}

      {/* Buffering State */}
      {player.state === 'buffering' && (
        <LoadingOverlay message="Buffering..." />
      )}

      {/* Recovering State */}
      {player.state === 'recovering' && player.retryInfo && (
        <RecoveringOverlay 
          attempt={player.retryInfo.attempt} 
          maxAttempts={player.retryInfo.maxAttempts} 
        />
      )}

      {/* Error State */}
      {player.state === 'error' && player.error && (
        <ErrorOverlay 
          message={player.error.message} 
          onRetry={player.reload} 
        />
      )}

      {/* Channel Info - visible when controls are visible */}
      {controlsVisible && player.state !== 'error' && (
        <ChannelInfo 
          name={channelName || branding?.name}
          logo={channelLogo || branding?.logoUrl}
          category={category}
          isLive={isLive}
        />
      )}

      {/* Controls - visible when controlsVisible and not in error state */}
      {showControls && controlsVisible && player.state !== 'error' && player.state !== 'loading' && (
        <PlayerControls
          isPlaying={player.isPlaying}
          isMuted={player.isMuted}
          volume={player.volume}
          isFullscreen={player.isFullscreen}
          onTogglePlay={player.togglePlay}
          onToggleMute={player.toggleMute}
          onVolumeChange={player.setVolume}
          onToggleFullscreen={player.toggleFullscreen}
          onBack={onBack}
        />
      )}

      {/* Live indicator badge */}
      {isLive && player.state === 'playing' && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1.5 bg-red-600 px-2 py-1 rounded text-xs text-white font-medium">
            <Wifi className="h-3 w-3" />
            LIVE
          </div>
        </div>
      )}
    </div>
  );
});

export default IPTVPlayerWhiteLabelV2;
