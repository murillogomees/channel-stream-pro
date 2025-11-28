/**
 * ============================================================================
 * usePlayerController - Controle Universal do Player
 * ============================================================================
 * 
 * Hook para controlar o player HLS com:
 * - Play/Pause/Seek
 * - Volume
 * - Fullscreen
 * - Estado reativo
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isError: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  errorMessage: string | null;
}

export interface PlayerControls {
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  retry: () => void;
}

interface UsePlayerControllerOptions {
  autoplay?: boolean;
  muted?: boolean;
  onError?: (error: string) => void;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function usePlayerController(options: UsePlayerControllerOptions = {}) {
  const {
    autoplay = true,
    muted = false,
    onError,
    onReady,
    onPlay,
    onPause,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const retryCountRef = useRef(0);

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    isPaused: true,
    isBuffering: false,
    isError: false,
    isMuted: muted,
    isFullscreen: false,
    currentTime: 0,
    duration: 0,
    volume: muted ? 0 : 1,
    errorMessage: null,
  });

  // ---------------------------------------------------------------------------
  // Video Event Handlers
  // ---------------------------------------------------------------------------

  const handlePlay = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
    onPause?.();
  }, [onPause]);

  const handleWaiting = useCallback(() => {
    setState(prev => ({ ...prev, isBuffering: true }));
  }, []);

  const handleCanPlay = useCallback(() => {
    setState(prev => ({ ...prev, isBuffering: false }));
    retryCountRef.current = 0;
  }, []);

  const handlePlaying = useCallback(() => {
    setState(prev => ({ ...prev, isBuffering: false, isError: false, errorMessage: null }));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setState(prev => ({
        ...prev,
        currentTime: videoRef.current?.currentTime || 0,
      }));
    }
  }, []);

  const handleDurationChange = useCallback(() => {
    if (videoRef.current) {
      setState(prev => ({
        ...prev,
        duration: videoRef.current?.duration || 0,
      }));
    }
  }, []);

  const handleVolumeChange = useCallback(() => {
    if (videoRef.current) {
      setState(prev => ({
        ...prev,
        volume: videoRef.current?.volume || 0,
        isMuted: videoRef.current?.muted || false,
      }));
    }
  }, []);

  const handleError = useCallback((e: Event) => {
    const video = e.target as HTMLVideoElement;
    const error = video.error;
    let message = 'Erro desconhecido';

    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          message = 'Reprodução interrompida';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          message = 'Erro de rede';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          message = 'Erro de decodificação';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'Formato não suportado';
          break;
      }
    }

    setState(prev => ({
      ...prev,
      isError: true,
      isBuffering: false,
      errorMessage: message,
    }));

    onError?.(message);
  }, [onError]);

  const handleLoadedMetadata = useCallback(() => {
    onReady?.();
    if (autoplay && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked, try muted
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [autoplay, onReady]);

  // ---------------------------------------------------------------------------
  // Fullscreen Handler
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleFullscreenChange = () => {
      setState(prev => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement,
      }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Bind Video Element
  // ---------------------------------------------------------------------------

  const bindVideoElement = useCallback((video: HTMLVideoElement | null) => {
    // Remove old listeners
    if (videoRef.current) {
      const old = videoRef.current;
      old.removeEventListener('play', handlePlay);
      old.removeEventListener('pause', handlePause);
      old.removeEventListener('waiting', handleWaiting);
      old.removeEventListener('canplay', handleCanPlay);
      old.removeEventListener('playing', handlePlaying);
      old.removeEventListener('timeupdate', handleTimeUpdate);
      old.removeEventListener('durationchange', handleDurationChange);
      old.removeEventListener('volumechange', handleVolumeChange);
      old.removeEventListener('error', handleError);
      old.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }

    videoRef.current = video;

    // Add new listeners
    if (video) {
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('volumechange', handleVolumeChange);
      video.addEventListener('error', handleError);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      // Initial state
      video.muted = muted;
    }
  }, [
    handlePlay, handlePause, handleWaiting, handleCanPlay, handlePlaying,
    handleTimeUpdate, handleDurationChange, handleVolumeChange, handleError,
    handleLoadedMetadata, muted
  ]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------

  const controls: PlayerControls = {
    play: async () => {
      if (videoRef.current) {
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('[PlayerController] Play failed:', e);
        }
      }
    },

    pause: () => {
      videoRef.current?.pause();
    },

    togglePlayPause: () => {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      }
    },

    seek: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, Math.min(time, videoRef.current.duration || 0));
      }
    },

    seekRelative: (delta: number) => {
      if (videoRef.current) {
        const newTime = videoRef.current.currentTime + delta;
        videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration || Infinity));
      }
    },

    setVolume: (volume: number) => {
      if (videoRef.current) {
        videoRef.current.volume = Math.max(0, Math.min(1, volume));
        if (volume > 0) {
          videoRef.current.muted = false;
        }
      }
    },

    toggleMute: () => {
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
      }
    },

    toggleFullscreen: () => {
      const container = containerRef.current;
      if (!container) return;

      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        const elem = container as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (elem.requestFullscreen) {
          elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        }
      }
    },

    retry: () => {
      if (videoRef.current) {
        const src = videoRef.current.src;
        videoRef.current.src = '';
        videoRef.current.load();
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.src = src;
            videoRef.current.load();
            videoRef.current.play().catch(() => {});
          }
        }, 100);
        setState(prev => ({ ...prev, isError: false, errorMessage: null }));
      }
    },
  };

  return {
    state,
    controls,
    videoRef,
    containerRef,
    bindVideoElement,
  };
}

export default usePlayerController;
