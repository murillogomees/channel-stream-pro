/**
 * IPTV Player Component
 * 
 * Modular player with Video.js + HLS.js, CDN failover, EPG, and remote control support.
 */

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  ArrowLeft, RefreshCw, Loader2, AlertCircle, Wifi, Settings,
  ChevronUp, ChevronDown, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoJs } from '../hooks/useVideoJs';
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useSmartTv } from '../hooks/useSmartTv';
import { useEpg } from '../hooks/useEpg';
import { cdnFailover } from '../services/cdnFailover';
import { playlistParser } from '../services/playlistParser';
import type { IptvPlayerProps, IptvChannel, IptvPlaylist, IptvPlayerEvent } from '../types';
import { EpgDisplay } from './EpgDisplay';
import { TvFocusableButton } from './TvFocusableButton';

import 'video.js/dist/video-js.css';

export const IptvPlayer = memo(function IptvPlayer({
  playlistUrl,
  channelId,
  epgUrl,
  authToken,
  options = {},
  onEvent,
  className,
}: IptvPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  
  // Smart TV detection
  const { 
    isTv, 
    platform, 
    uiScale, 
    showFocusIndicators, 
    hlsConfig,
    focusedElement,
    setFocus,
  } = useSmartTv();
  
  // State
  const [playlist, setPlaylist] = useState<IptvPlaylist | null>(null);
  const [currentChannel, setCurrentChannel] = useState<IptvChannel | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showEpg, setShowEpg] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(options.muted ?? true);

  // Video.js hook with Smart TV config
  const {
    videoRef,
    isReady,
    isPlaying,
    isBuffering,
    error,
    metrics,
    play,
    pause,
    seek,
    setVolume: setPlayerVolume,
    toggleMute,
    toggleFullscreen: vjsToggleFullscreen,
    setSource,
  } = useVideoJs({
    options: {
      autoplay: options.autoplay ?? true,
      muted: options.muted ?? true,
      preferLowLatency: !isTv && (options.preferLowLatency ?? true), // Disable low latency on TVs
      maxRetries: options.maxRetries ?? (isTv ? 5 : 3), // More retries on TVs
    },
    hlsConfig: isTv ? hlsConfig : undefined, // Use TV-optimized HLS config
    onEvent: handlePlayerEvent,
  });

  // EPG hook
  const { currentProgram, upcomingPrograms, isLoading: epgLoading } = useEpg({
    channelId: currentChannel?.tvgId || currentChannel?.id,
    epgUrl,
  });

  // Load playlist
  useEffect(() => {
    if (!playlistUrl) return;

    const loadPlaylist = async () => {
      try {
        const data = await playlistParser.parseFromUrl(playlistUrl, authToken);
        setPlaylist(data);
        
        // Auto-select first channel or by channelId
        if (data.channels.length > 0) {
          const channel = channelId 
            ? data.channels.find(c => c.id === channelId) 
            : data.channels[0];
          if (channel) {
            selectChannel(channel);
          }
        }
        
        onEvent?.('ready', { channelCount: data.channels.length });
      } catch (err) {
        console.error('[IptvPlayer] Playlist load error:', err);
        onEvent?.('error', { type: 'playlist', error: err });
      }
    };

    loadPlaylist();
  }, [playlistUrl, channelId, authToken]);

  // Initialize CDN failover
  useEffect(() => {
    if (currentChannel) {
      const endpoints = cdnFailover.buildEndpointsFromUrl(
        currentChannel.url,
        currentChannel.id
      );
      
      // Add custom fallbacks
      if (options.cdnFallback) {
        options.cdnFallback.forEach((url, idx) => {
          endpoints.push({
            url,
            priority: 10 + idx,
            type: 'origin',
          });
        });
      }
      
      cdnFailover.initialize(endpoints);
      cdnFailover.setEventCallback(onEvent || (() => {}));
    }
  }, [currentChannel, options.cdnFallback, onEvent]);

  // Select channel
  const selectChannel = useCallback((channel: IptvChannel) => {
    setCurrentChannel(channel);
    
    // Use CDN failover to get optimal URL
    const endpoints = cdnFailover.buildEndpointsFromUrl(channel.url, channel.id);
    cdnFailover.initialize(endpoints);
    
    const url = cdnFailover.getCurrentUrl();
    if (url) {
      setSource(url);
    }
    
    onEvent?.('channelchange', { channel });
  }, [setSource, onEvent]);

  // Handle player events
  function handlePlayerEvent(evt: IptvPlayerEvent, data?: any) {
    console.log('[IptvPlayer] Event:', evt, data);
    
    if (evt === 'error' && currentChannel) {
      // Attempt CDN failover
      cdnFailover.handleError(new Error(data?.message || 'Playback error'))
        .then(newUrl => {
          if (newUrl) {
            setSource(newUrl);
          }
        });
    }
    
    onEvent?.(evt, data);
  }

  // Remote control handlers
  useRemoteControl({
    onTogglePlay: () => isPlaying ? pause() : play(),
    onPlay: play,
    onPause: pause,
    onForward: (secs) => {
      const video = videoRef.current;
      if (video) seek(video.currentTime + secs);
    },
    onRewind: (secs) => {
      const video = videoRef.current;
      if (video) seek(Math.max(0, video.currentTime - secs));
    },
    onVolumeUp: () => {
      const newVol = Math.min(1, volume + 0.1);
      setVolumeState(newVol);
      setPlayerVolume(newVol);
    },
    onVolumeDown: () => {
      const newVol = Math.max(0, volume - 0.1);
      setVolumeState(newVol);
      setPlayerVolume(newVol);
    },
    onMute: () => {
      toggleMute();
      setIsMuted(!isMuted);
    },
    onFullscreen: handleToggleFullscreen,
    onChannelUp: () => navigateChannel(1),
    onChannelDown: () => navigateChannel(-1),
    onChannelDirect: handleDirectChannel,
    onInfo: () => setShowEpg(!showEpg),
    onBack: () => onEvent?.('back'),
  });

  // Channel navigation
  function navigateChannel(direction: number) {
    if (!playlist || !currentChannel) return;
    
    const idx = playlist.channels.findIndex(c => c.id === currentChannel.id);
    const newIdx = (idx + direction + playlist.channels.length) % playlist.channels.length;
    selectChannel(playlist.channels[newIdx]);
  }

  function handleDirectChannel(num: number) {
    if (!playlist) return;
    
    // Find by channel number (1-indexed)
    if (num > 0 && num <= playlist.channels.length) {
      selectChannel(playlist.channels[num - 1]);
    }
  }

  // Fullscreen toggle
  function handleToggleFullscreen() {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }

  // Control visibility
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  // Retry handler
  const handleRetry = useCallback(() => {
    if (currentChannel) {
      cdnFailover.reset();
      selectChannel(currentChannel);
    }
  }, [currentChannel, selectChannel]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative w-full h-full bg-black overflow-hidden',
        'focus:outline-none',
        className
      )}
      onMouseMove={showControlsTemporarily}
      onClick={showControlsTemporarily}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered w-full h-full object-contain"
        playsInline
      />

      {/* Loading State */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <span className="text-sm text-white/80">Carregando...</span>
            {currentChannel && (
              <span className="text-xs text-white/60">{currentChannel.name}</span>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive" />
            <p className="text-white font-medium">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Top Bar - Channel Info */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            {currentChannel?.logo && (
              <img 
                src={currentChannel.logo} 
                alt="" 
                className="w-10 h-10 object-contain rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-semibold truncate">
                {currentChannel?.name || 'Sem canal'}
              </h2>
              {currentProgram && (
                <p className="text-white/70 text-sm truncate">
                  {currentProgram.title}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowEpg(!showEpg)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Info className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {/* Metrics */}
          {isReady && (
            <div className="flex items-center gap-4 mb-3 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                {(metrics.currentBitrate / 1000000).toFixed(1)} Mbps
              </span>
              <span>Buffer: {metrics.bufferLength.toFixed(1)}s</span>
              {metrics.cdnSwitches > 0 && (
                <span>CDN switches: {metrics.cdnSwitches}</span>
              )}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center gap-4">
            {/* Channel Nav */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => navigateChannel(-1)}
                className="p-1 rounded bg-white/10 hover:bg-white/20"
                title="Canal anterior"
              >
                <ChevronUp className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => navigateChannel(1)}
                className="p-1 rounded bg-white/10 hover:bg-white/20"
                title="Próximo canal"
              >
                <ChevronDown className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Play/Pause */}
            <button
              onClick={() => isPlaying ? pause() : play()}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Volume */}
            <button
              onClick={() => {
                toggleMute();
                setIsMuted(!isMuted);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>

            <div className="flex-1" />

            {/* Settings */}
            <button
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={handleToggleFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-white" />
              ) : (
                <Maximize className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* EPG Panel */}
      {showEpg && (
        <EpgDisplay
          currentProgram={currentProgram}
          upcomingPrograms={upcomingPrograms}
          isLoading={epgLoading}
          onClose={() => setShowEpg(false)}
        />
      )}
    </div>
  );
});

export default IptvPlayer;
