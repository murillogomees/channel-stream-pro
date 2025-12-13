/**
 * useIPTVPlayerV2 - Enterprise IPTV Player Hook
 * 
 * Hook otimizado para playback IPTV com:
 * - PlayerEngineV2 integration
 * - Gestão de estado completa
 * - Controles de mídia
 * - Fullscreen API
 * - Error handling elegante
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { PlayerEngineV2, PlayerError, PlayerStats } from '@/components/player/core/PlayerEngineV2';

// =============================================================================
// TYPES
// =============================================================================
export type PlayerState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error' | 'recovering';

export interface UseIPTVPlayerV2Options {
  autoPlay?: boolean;
  lowLatency?: boolean;
  onReady?: () => void;
  onError?: (error: PlayerError) => void;
}

export interface UseIPTVPlayerV2Return {
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  
  // State
  state: PlayerState;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  error: PlayerError | null;
  retryInfo: { attempt: number; maxAttempts: number } | null;
  stats: PlayerStats | null;
  
  // Actions
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  seek: (delta: number) => void;
  seekTo: (time: number) => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
  reload: () => void;
  destroy: () => void;
  loadSource: (url: string) => void;
  
  // Computed
  isLive: boolean;
  isActive: boolean;
}

// =============================================================================
// BUILD PROXY URL
// =============================================================================
function buildProxyUrl(originalUrl: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('[useIPTVPlayerV2] VITE_SUPABASE_URL not configured');
    return originalUrl;
  }
  
  const proxyBase = `${supabaseUrl}/functions/v1/stream-proxy`;
  return `${proxyBase}?url=${encodeURIComponent(originalUrl)}`;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================
export function useIPTVPlayerV2(options: UseIPTVPlayerV2Options = {}): UseIPTVPlayerV2Return {
  const {
    autoPlay = true,
    lowLatency = true,
    onReady,
    onError,
  } = options;

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlayerEngineV2 | null>(null);

  // State
  const [state, setState] = useState<PlayerState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<PlayerError | null>(null);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; maxAttempts: number } | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // Initialize engine
  const initEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;

    engineRef.current = new PlayerEngineV2({
      lowLatency,
      maxRetries: 3,
      onReady: () => {
        setState('playing');
        setError(null);
        setRetryInfo(null);
        onReady?.();
      },
      onBuffering: (isBuffering) => {
        if (isBuffering) {
          setState('buffering');
        } else {
          setState('playing');
        }
      },
      onError: (playerError) => {
        setState('error');
        setError(playerError);
        setRetryInfo(null);
        onError?.(playerError);
      },
      onRecovering: (attempt, maxAttempts) => {
        setState('recovering');
        setRetryInfo({ attempt, maxAttempts });
      },
      onStats: (playerStats) => {
        setStats(playerStats);
      },
    });

    return engineRef.current;
  }, [lowLatency, onReady, onError]);

  // Load source
  const loadSource = useCallback((originalUrl: string) => {
    const video = videoRef.current;
    if (!video) {
      console.error('[useIPTVPlayerV2] Video element not found');
      return;
    }

    // Build proxied URL
    const proxiedUrl = buildProxyUrl(originalUrl);
    console.log(`[useIPTVPlayerV2] Loading: ${originalUrl.substring(0, 50)}...`);

    setState('loading');
    setError(null);
    setRetryInfo(null);

    const engine = initEngine();
    const success = engine.attach(video, proxiedUrl);

    if (!success) {
      setState('error');
    }
  }, [initEngine]);

  // Video element event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (state !== 'buffering') {
        setState('playing');
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      setState('paused');
    };

    const handleWaiting = () => {
      setState('buffering');
    };

    const handlePlaying = () => {
      setState('playing');
    };

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
  }, [state]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  // Stats polling
  useEffect(() => {
    if (state !== 'playing') return;

    const interval = setInterval(() => {
      const playerStats = engineRef.current?.getStats();
      if (playerStats) {
        setStats(playerStats);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state]);

  // Actions
  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {});
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
    }
  }, []);

  const unmute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
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
    }
  }, []);

  const seek = useCallback((delta: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += delta;
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      const container = containerRef.current;
      if (container) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
      }
    } catch (err) {
      console.error('[useIPTVPlayerV2] Fullscreen error:', err);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
    } catch (err) {
      console.error('[useIPTVPlayerV2] Exit fullscreen error:', err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const reload = useCallback(() => {
    engineRef.current?.reload();
    setState('loading');
    setError(null);
    setRetryInfo(null);
  }, []);

  const destroy = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
    setState('idle');
    setError(null);
    setRetryInfo(null);
  }, []);

  // Computed values
  const isLive = !isFinite(duration) || duration === 0;
  const isActive = engineRef.current?.isActive() || false;

  return {
    videoRef,
    containerRef,
    state,
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    isFullscreen,
    error,
    retryInfo,
    stats,
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
    destroy,
    loadSource,
    isLive,
    isActive,
  };
}

export default useIPTVPlayerV2;
