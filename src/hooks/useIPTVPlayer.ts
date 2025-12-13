/**
 * useIPTVPlayer - Hook central para gerenciar o player IPTV
 * 
 * @features
 * - Integração com PlayerEngine
 * - Gestão de estado do player
 * - Controles de mídia
 * - Navegação de canais
 * - Retry automático
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PlayerEngine, PlayerEngineConfig, PlayerError, PlayerStats } from '@/components/player/core/PlayerEngine';
import { OverlayState } from '@/components/player/ui/PlayerOverlay';

interface UseIPTVPlayerOptions {
  /** Auto-play when source is loaded */
  autoPlay?: boolean;
  /** Enable low latency mode */
  lowLatency?: boolean;
  /** Initial muted state */
  initialMuted?: boolean;
  /** Custom headers for stream requests */
  headers?: Record<string, string>;
  /** Callback when player is ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: PlayerError) => void;
}

interface UseIPTVPlayerReturn {
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  
  // State
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  overlayState: OverlayState;
  errorMessage: string | null;
  retryAttempt: number;
  maxRetries: number;
  stats: PlayerStats | null;
  
  // Controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  seek: (seconds: number) => void;
  seekTo: (time: number) => void;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  reload: () => void;
  
  // Source management
  loadSource: (url: string) => void;
  destroy: () => void;
  
  // Info
  isLive: boolean;
  isActive: boolean;
}

export function useIPTVPlayer(options: UseIPTVPlayerOptions = {}): UseIPTVPlayerReturn {
  const {
    autoPlay = true,
    lowLatency = false,
    initialMuted = true,
    headers,
    onReady,
    onError,
  } = options;

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlayerEngine | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [overlayState, setOverlayState] = useState<OverlayState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  const maxRetries = 3;

  // Initialize engine
  const initEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
    }

    const config: PlayerEngineConfig = {
      lowLatency,
      headers,
    };

    const engine = new PlayerEngine(config, {
      onReady: () => {
        setOverlayState('idle');
        setErrorMessage(null);
        setRetryAttempt(0);
        onReady?.();
      },
      onBuffering: (isBuffering) => {
        if (isBuffering && overlayState !== 'error') {
          setOverlayState('buffering');
        } else if (!isBuffering && overlayState === 'buffering') {
          setOverlayState('idle');
        }
      },
      onError: (error) => {
        setOverlayState('error');
        setErrorMessage(error.message);
        onError?.(error);
      },
      onRecovering: (attempt, max) => {
        setOverlayState('reconnecting');
        setRetryAttempt(attempt);
      },
      onStats: (newStats) => {
        setStats(newStats);
      },
    });

    engineRef.current = engine;
  }, [lowLatency, headers, onReady, onError, overlayState]);

  // Load source URL
  const loadSource = useCallback((url: string) => {
    if (!videoRef.current) return;

    if (!engineRef.current) {
      initEngine();
    }

    currentUrlRef.current = url;
    setOverlayState('buffering');
    setErrorMessage(null);

    const video = videoRef.current;
    
    // Set initial video properties
    video.muted = initialMuted;
    video.playsInline = true;

    // Attach engine
    engineRef.current?.attach(video, url);
  }, [initEngine, initialMuted]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => {
      if (overlayState !== 'error') {
        setOverlayState('buffering');
      }
    };
    const handlePlaying = () => setOverlayState('idle');
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
    };
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
      setVolumeState(video.volume);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [overlayState]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  // Controls
  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {
      // Autoplay blocked, try muted
      if (videoRef.current) {
        videoRef.current.muted = true;
        setIsMuted(true);
        videoRef.current.play().catch(() => {});
      }
    });
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const mute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [isMuted, mute, unmute]);

  const setVolume = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, newVolume));
      setVolumeState(videoRef.current.volume);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (e) {
        console.warn('[useIPTVPlayer] Fullscreen error:', e);
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      await document.exitFullscreen();
      setIsFullscreen(false);
    } catch (e) {
      console.warn('[useIPTVPlayer] Exit fullscreen error:', e);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const reload = useCallback(() => {
    setRetryAttempt(0);
    setErrorMessage(null);
    engineRef.current?.reload();
  }, []);

  const destroy = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
    currentUrlRef.current = null;
  }, []);

  // Computed
  const isLive = duration === 0 || !isFinite(duration);
  const isActive = engineRef.current?.isActive() || false;

  return {
    // Refs
    videoRef,
    containerRef,
    
    // State
    isPlaying,
    isMuted,
    isFullscreen,
    volume,
    currentTime,
    duration,
    overlayState,
    errorMessage,
    retryAttempt,
    maxRetries,
    stats,
    
    // Controls
    play,
    pause,
    togglePlay,
    mute,
    unmute,
    toggleMute,
    setVolume,
    seek,
    seekTo,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    reload,
    
    // Source
    loadSource,
    destroy,
    
    // Info
    isLive,
    isActive,
  };
}

export default useIPTVPlayer;
