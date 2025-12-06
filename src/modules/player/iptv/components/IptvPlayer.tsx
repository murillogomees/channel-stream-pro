/**
 * IPTV Player Component
 * 
 * Modular player with Video.js + HLS.js, CDN failover, EPG, and remote control support.
 * Now with advanced controls: quality, speed, filters, PiP, gestures, stats, parental control.
 */

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  RefreshCw, Loader2, AlertCircle, Wifi, Settings,
  ChevronUp, ChevronDown, Info, MoreVertical, PictureInPicture,
  SkipForward, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoJs } from '../hooks/useVideoJs';
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useSmartTv } from '../hooks/useSmartTv';
import { useEpg } from '../hooks/useEpg';
import { useAdvancedPlayerControls } from '../hooks/useAdvancedPlayerControls';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { cdnFailover } from '../services/cdnFailover';
import { playlistParser } from '../services/playlistParser';
import type { IptvPlayerProps, IptvChannel, IptvPlaylist, IptvPlayerEvent } from '../types';
import { EpgDisplay } from './EpgDisplay';
import { PlayerSettingsPanel, usePlayerSettings } from './PlayerSettingsPanel';
import { PlayerQuickControls } from './PlayerQuickControls';
import { GestureOverlay } from './GestureOverlay';
import { StatsOverlay } from './StatsOverlay';

import 'video.js/dist/video-js.css';

export const IptvPlayer = memo(function IptvPlayer({
  playlistUrl,
  streamUrl,
  channelId,
  channelName,
  channelLogo,
  epgUrl,
  authToken,
  options = {},
  onEvent,
  className,
}: IptvPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  
  // Keep callback ref updated
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  
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
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickControls, setShowQuickControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [brightness, setBrightness] = useState(100);
  
  // Load persisted settings
  const { settings: playerSettings, updateSettings: setPlayerSettings, isLoaded: settingsLoaded } = usePlayerSettings();
  const [isMuted, setIsMuted] = useState(options.muted ?? playerSettings.muted);

  // Advanced player controls
  const advancedControls = useAdvancedPlayerControls();

  // Touch gestures for mobile
  const touchGestures = useTouchGestures({
    config: { enabled: playerSettings.enableTouchGestures },
    onVolumeChange: (delta) => {
      const newVol = Math.max(0, Math.min(1, volume + delta));
      setVolumeState(newVol);
      setPlayerVolume?.(newVol);
    },
    onBrightnessChange: (delta) => {
      const newBrightness = Math.max(50, Math.min(150, brightness + delta));
      setBrightness(newBrightness);
      advancedControls.setFilters({ brightness: newBrightness });
    },
    onSeek: (delta) => {
      const video = videoRef.current;
      if (video) seek?.(video.currentTime + delta);
    },
  });

  // Handle player events - memoized to prevent re-renders
  const handlePlayerEvent = useCallback((evt: IptvPlayerEvent, data?: any) => {
    // Skip logging high-frequency events to reduce console spam
    if (evt !== 'timeupdate') {
      console.log('[IptvPlayer] Event:', evt, data);
    }
    onEventRef.current?.(evt, data);
  }, []);

  // Control visibility - declare early to maintain hook order
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Video.js hook with Smart TV config
  // Merge options with persisted settings
  const mergedOptions = {
    autoplay: options.autoplay ?? playerSettings.autoplay,
    muted: options.muted ?? playerSettings.muted,
    preferLowLatency: options.preferLowLatency ?? playerSettings.preferLowLatency,
    maxRetries: options.maxRetries ?? playerSettings.maxRetries,
    poster: options.poster,
  };

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
    hlsInstance,
  } = useVideoJs({
    options: {
      autoplay: mergedOptions.autoplay,
      muted: mergedOptions.muted,
      preferLowLatency: !isTv && mergedOptions.preferLowLatency,
      maxRetries: isTv ? 5 : mergedOptions.maxRetries,
    },
    hlsConfig: isTv ? hlsConfig : undefined,
    onEvent: handlePlayerEvent,
  });

  // Attach advanced controls to video/hls
  useEffect(() => {
    if (videoRef.current) {
      advancedControls.attachVideo(videoRef.current);
    }
  }, [videoRef.current, advancedControls.attachVideo]);

  useEffect(() => {
    if (hlsInstance) {
      advancedControls.attachHls(hlsInstance);
    }
  }, [hlsInstance, advancedControls.attachHls]);

  // Apply default filters from settings
  useEffect(() => {
    if (playerSettings.defaultFilters) {
      advancedControls.setFilters(playerSettings.defaultFilters);
    }
  }, [playerSettings.defaultFilters]);

  // Apply default playback speed
  useEffect(() => {
    if (playerSettings.defaultSpeed !== 1) {
      advancedControls.setPlaybackSpeed(playerSettings.defaultSpeed);
    }
  }, [playerSettings.defaultSpeed]);

  // EPG hook
  const { currentProgram, upcomingPrograms, isLoading: epgLoading } = useEpg({
    channelId: currentChannel?.tvgId || currentChannel?.id,
    epgUrl,
  });

  // Track previous streamUrl to detect actual changes
  const prevStreamUrlRef = useRef<string | undefined>();

  // Direct stream URL mode - load immediately without playlist
  useEffect(() => {
    // Skip if no streamUrl or if playlistUrl is provided
    if (!streamUrl || playlistUrl) return;
    
    // Only initialize once per unique streamUrl
    if (prevStreamUrlRef.current === streamUrl && initializedRef.current) return;
    
    console.log('[IptvPlayer] Direct stream mode:', streamUrl.substring(0, 80));
    prevStreamUrlRef.current = streamUrl;
    initializedRef.current = true;
    
    // Create a virtual channel for display
    const virtualChannel: IptvChannel = {
      id: channelId || 'direct-stream',
      name: channelName || 'Stream',
      url: streamUrl,
      logo: channelLogo,
    };
    
    setCurrentChannel(virtualChannel);
    
    // Pass ORIGINAL URL to setSource - useVideoJs handles proxy internally
    // Don't double-optimize here or protocol detection will fail
    console.log('[IptvPlayer] Setting source (original URL)');
    setSource(streamUrl);
    onEventRef.current?.('ready', { channelCount: 1 });
  }, [streamUrl, playlistUrl, channelId, channelName, channelLogo, setSource]);

  // Select channel - declared BEFORE useEffects that use it
  const selectChannel = useCallback((channel: IptvChannel) => {
    setCurrentChannel(channel);
    
    // Initialize CDN failover with proper options
    // For HTTP URLs, only use proxy (not R2/CF-Stream that don't exist)
    const endpoints = cdnFailover.buildEndpointsFromUrl(
      channel.url, 
      channel.id,
      {
        hasR2: false,  // Only enable if channel.r2_uploaded exists
        hasCfStream: false,  // Only enable if channel.cf_stream_url exists
      }
    );
    cdnFailover.initialize(endpoints);
    
    // Pass ORIGINAL URL to setSource - useVideoJs handles proxy internally
    console.log('[IptvPlayer] selectChannel:', channel.name);
    setSource(channel.url);
    
    onEventRef.current?.('channelchange', { channel });
  }, [setSource]);

  // Retry handler - declared after selectChannel since it depends on it
  const handleRetry = useCallback(() => {
    if (currentChannel) {
      cdnFailover.reset();
      selectChannel(currentChannel);
    }
  }, [currentChannel, selectChannel]);

  // Load playlist (original behavior)
  useEffect(() => {
    if (!playlistUrl) return;
    if (streamUrl) return; // Skip if direct stream mode

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
        
        onEventRef.current?.('ready', { channelCount: data.channels.length });
      } catch (err) {
        console.error('[IptvPlayer] Playlist load error:', err);
        onEventRef.current?.('error', { type: 'playlist', error: err });
      }
    };

    loadPlaylist();
  }, [playlistUrl, channelId, authToken, streamUrl, selectChannel]);

  // Initialize CDN failover
  useEffect(() => {
    if (currentChannel) {
      // Build endpoints with proper options - no R2/CF for basic IPTV
      const endpoints = cdnFailover.buildEndpointsFromUrl(
        currentChannel.url,
        currentChannel.id,
        {
          hasR2: false,
          hasCfStream: false,
        }
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
      cdnFailover.setEventCallback(onEventRef.current || (() => {}));
    }
  }, [currentChannel, options.cdnFallback]);

  // Handle CDN failover on error - with guard to prevent infinite loops
  const lastErrorRef = useRef<string | null>(null);
  const errorRetryCount = useRef(0);
  const maxErrorRetries = 3;
  
  useEffect(() => {
    // Skip if no error or no channel
    if (!error || !currentChannel) return;
    
    // Skip if same error already handled or max retries exceeded
    if (error === lastErrorRef.current || errorRetryCount.current >= maxErrorRetries) {
      if (errorRetryCount.current >= maxErrorRetries) {
        console.log('[IptvPlayer] Max CDN failover retries reached, stopping');
      }
      return;
    }
    
    lastErrorRef.current = error;
    errorRetryCount.current++;
    
    console.log('[IptvPlayer] Attempting CDN failover, attempt:', errorRetryCount.current);
    
    cdnFailover.handleError(new Error(error))
      .then(newUrl => {
        if (newUrl) {
          setSource(newUrl);
        }
      });
  }, [error, currentChannel, setSource]);

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
    onBack: () => onEventRef.current?.('back'),
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

  // Handle touch gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    touchGestures.handleTouchStart(
      e, 
      containerRef.current.clientWidth, 
      volume, 
      brightness
    );
  };

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
      onTouchStart={handleTouchStart}
      onTouchMove={touchGestures.handleTouchMove}
      onTouchEnd={touchGestures.handleTouchEnd}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered w-full h-full object-contain"
        playsInline
      />

      {/* Gesture Overlay */}
      <GestureOverlay gestureState={touchGestures.gestureState} />

      {/* Stats Overlay */}
      <StatsOverlay 
        stats={advancedControls.state.stats} 
        isVisible={advancedControls.state.showStats} 
      />

      {/* Sleep Timer Indicator */}
      {advancedControls.state.sleepTimerRemaining !== null && (
        <div className="absolute top-16 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2 z-40">
          <Timer className="w-4 h-4 text-primary" />
          <span className="text-white text-sm font-mono">
            {advancedControls.state.sleepTimerRemaining} min
          </span>
        </div>
      )}

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
            
            {/* Skip Intro Button */}
            {playerSettings.skipIntroSeconds > 0 && (
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) seek(video.currentTime + playerSettings.skipIntroSeconds);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <SkipForward className="w-4 h-4 text-white" />
                <span className="text-white text-sm">Pular +{playerSettings.skipIntroSeconds}s</span>
              </button>
            )}
            
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
              {advancedControls.state.playbackSpeed !== 1 && (
                <span>{advancedControls.state.playbackSpeed}x</span>
              )}
              {metrics.cdnSwitches > 0 && (
                <span>CDN: {metrics.cdnSwitches}</span>
              )}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
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

            {/* PiP Button */}
            {advancedControls.state.isPipSupported && playerSettings.enablePip && (
              <button
                onClick={advancedControls.togglePip}
                className={cn(
                  "p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors",
                  advancedControls.state.isPipActive && "bg-primary/30"
                )}
                title="Picture-in-Picture"
              >
                <PictureInPicture className="w-5 h-5 text-white" />
              </button>
            )}

            {/* Quick Controls (Quality, Speed, etc.) */}
            <button
              onClick={() => setShowQuickControls(!showQuickControls)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Controles rápidos"
            >
              <MoreVertical className="w-5 h-5 text-white" />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
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

      {/* Quick Controls Popup */}
      <PlayerQuickControls
        isOpen={showQuickControls}
        onClose={() => setShowQuickControls(false)}
        qualities={advancedControls.state.qualities}
        currentQuality={advancedControls.state.currentQuality}
        onQualityChange={advancedControls.setQuality}
        currentSpeed={advancedControls.state.playbackSpeed}
        onSpeedChange={advancedControls.setPlaybackSpeed}
        audioTracks={advancedControls.state.audioTracks}
        currentAudioTrack={advancedControls.state.currentAudioTrack}
        onAudioChange={advancedControls.setAudioTrack}
        subtitleTracks={advancedControls.state.subtitleTracks}
        currentSubtitle={advancedControls.state.currentSubtitle}
        onSubtitleChange={advancedControls.setSubtitle}
        onSubtitleDisable={advancedControls.disableSubtitles}
        currentAspect={advancedControls.state.aspectRatio}
        onAspectChange={advancedControls.setAspectRatio}
        isPipSupported={advancedControls.state.isPipSupported}
        isPipActive={advancedControls.state.isPipActive}
        onTogglePip={advancedControls.togglePip}
        showStats={advancedControls.state.showStats}
        stats={advancedControls.state.stats}
        onToggleStats={advancedControls.toggleStats}
        sleepTimerRemaining={advancedControls.state.sleepTimerRemaining}
        onSetSleepTimer={advancedControls.setSleepTimer}
      />

      {/* EPG Panel */}
      {showEpg && (
        <EpgDisplay
          currentProgram={currentProgram}
          upcomingPrograms={upcomingPrograms}
          isLoading={epgLoading}
          onClose={() => setShowEpg(false)}
        />
      )}

      {/* Settings Panel */}
      <PlayerSettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={playerSettings}
        onSettingsChange={setPlayerSettings}
      />
    </div>
  );
});

export default IptvPlayer;
