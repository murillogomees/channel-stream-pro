/**
 * IPTVPlayerWhiteLabel - Player IPTV profissional white-label
 * 
 * @architecture
 * - Nível Netflix/Pluto TV
 * - UI/UX moderna e responsiva
 * - Suporte a TV, Desktop e Mobile
 * - Sistema de branding configurável
 * - Gestão de erros inteligente
 * 
 * @rules
 * - Aceita SOMENTE .m3u8 como source
 * - Carregamento de .ts gerenciado pelo HLS engine
 * - Retry com backoff em erros 403
 * - Uma sessão = um player
 */

import { memo, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useIPTVPlayer } from '@/hooks/useIPTVPlayer';
import { PlayerBranding, BrandingConfig } from './ui/PlayerBranding';
import { PlayerOverlay } from './ui/PlayerOverlay';
import { PlayerControlsTV } from './ui/PlayerControlsTV';

export interface IPTVPlayerWhiteLabelProps {
  /** Stream URL (.m3u8 only) */
  url: string;
  /** Channel/content info for branding */
  branding?: BrandingConfig;
  /** Auto-play when loaded */
  autoPlay?: boolean;
  /** Enable low latency mode */
  lowLatency?: boolean;
  /** Custom headers for authentication */
  headers?: Record<string, string>;
  /** Hide controls after inactivity (ms) */
  controlsTimeout?: number;
  /** Show channel navigation */
  showChannelNav?: boolean;
  /** Favorite state */
  isFavorite?: boolean;
  /** Callbacks */
  onBack?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onToggleFavorite?: () => void;
  onShowChannelList?: () => void;
  onShowSettings?: () => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  /** Custom className */
  className?: string;
}

export const IPTVPlayerWhiteLabel = memo(function IPTVPlayerWhiteLabel({
  url,
  branding = {},
  autoPlay = true,
  lowLatency = false,
  headers,
  controlsTimeout = 4000,
  showChannelNav = true,
  isFavorite = false,
  onBack,
  onChannelUp,
  onChannelDown,
  onToggleFavorite,
  onShowChannelList,
  onShowSettings,
  onReady,
  onError,
  className,
}: IPTVPlayerWhiteLabelProps) {
  // Player hook
  const player = useIPTVPlayer({
    autoPlay,
    lowLatency,
    initialMuted: true,
    headers,
    onReady,
    onError: (error) => onError?.(error.message),
  });

  // Controls visibility state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hideTimeoutId, setHideTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Show controls and reset timeout
  const showControls = useCallback(() => {
    setControlsVisible(true);
    
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
    }
    
    const newTimeout = setTimeout(() => {
      if (player.isPlaying) {
        setControlsVisible(false);
      }
    }, controlsTimeout);
    
    setHideTimeoutId(newTimeout);
  }, [controlsTimeout, player.isPlaying, hideTimeoutId]);

  // Load source when URL changes
  useEffect(() => {
    if (url) {
      player.loadSource(url);
    }
    
    return () => {
      player.destroy();
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
      }
    };
  }, [hideTimeoutId]);

  // Initial controls show
  useEffect(() => {
    showControls();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle container click
  const handleContainerClick = useCallback(() => {
    if (controlsVisible) {
      player.togglePlay();
    } else {
      showControls();
    }
  }, [controlsVisible, player.togglePlay, showControls]);

  return (
    <div
      ref={player.containerRef}
      className={cn(
        'relative w-full h-full bg-black overflow-hidden select-none',
        'focus:outline-none',
        className
      )}
      onMouseMove={showControls}
      onTouchStart={showControls}
      onClick={handleContainerClick}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={player.videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        autoPlay={autoPlay}
        muted={player.isMuted}
      />

      {/* Overlay States (Loading, Error, Reconnecting) */}
      <PlayerOverlay
        state={player.overlayState}
        message={player.errorMessage || undefined}
        retryAttempt={player.retryAttempt}
        maxRetries={player.maxRetries}
        onRetry={player.reload}
      />

      {/* Controls Overlay */}
      {player.overlayState === 'idle' && (
        <>
          {/* Branding - Top Left */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 p-4 sm:p-6',
              'bg-gradient-to-b from-black/80 to-transparent',
              'transition-opacity duration-300',
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <PlayerBranding
              config={{
                ...branding,
                isLive: player.isLive,
              }}
              size="md"
            />
          </div>

          {/* TV Controls */}
          <PlayerControlsTV
            isPlaying={player.isPlaying}
            isMuted={player.isMuted}
            isFullscreen={player.isFullscreen}
            volume={player.volume}
            currentTime={player.currentTime}
            duration={player.duration}
            isLive={player.isLive}
            isFavorite={isFavorite}
            onPlay={player.play}
            onPause={player.pause}
            onMute={player.mute}
            onUnmute={player.unmute}
            onVolumeChange={player.setVolume}
            onFullscreen={player.enterFullscreen}
            onExitFullscreen={player.exitFullscreen}
            onSeek={player.seek}
            onBack={onBack}
            onChannelUp={showChannelNav ? onChannelUp : undefined}
            onChannelDown={showChannelNav ? onChannelDown : undefined}
            onToggleFavorite={onToggleFavorite}
            onShowChannelList={onShowChannelList}
            onShowSettings={onShowSettings}
            visible={controlsVisible}
          />
        </>
      )}
    </div>
  );
});

export default IPTVPlayerWhiteLabel;
