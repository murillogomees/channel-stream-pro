/**
 * useAutoFullscreen - Auto fullscreen & landscape rotation on video start
 * 
 * Automatically enters fullscreen and rotates to landscape when video starts playing.
 * Optimized for mobile viewing experience.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseAutoFullscreenOptions {
  enabled?: boolean;
  lockOrientation?: boolean;
  exitOnPause?: boolean;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

export function useAutoFullscreen(options: UseAutoFullscreenOptions = {}) {
  const {
    enabled = true,
    lockOrientation = true,
    exitOnPause = false,
    onEnterFullscreen,
    onExitFullscreen,
  } = options;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const [supportsOrientation, setSupportsOrientation] = useState(false);

  const containerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wasFullscreenRef = useRef(false);

  // Check support on mount
  useEffect(() => {
    setSupportsFullscreen(
      !!(document.fullscreenEnabled || 
        (document as any).webkitFullscreenEnabled ||
        (document as any).mozFullScreenEnabled ||
        (document as any).msFullscreenEnabled)
    );

    setSupportsOrientation(
      !!(screen.orientation && 'lock' in screen.orientation)
    );

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      setIsFullscreen(isNowFullscreen);
      
      if (isNowFullscreen) {
        onEnterFullscreen?.();
      } else {
        onExitFullscreen?.();
        // Unlock orientation when exiting fullscreen
        if (supportsOrientation) {
          try {
            screen.orientation.unlock();
          } catch {}
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Listen for orientation changes
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    handleOrientationChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [onEnterFullscreen, onExitFullscreen, supportsOrientation]);

  /**
   * Enter fullscreen mode
   */
  const enterFullscreen = useCallback(async (element?: HTMLElement) => {
    const target = element || containerRef.current || document.documentElement;
    
    try {
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if ((target as any).webkitRequestFullscreen) {
        await (target as any).webkitRequestFullscreen();
      } else if ((target as any).mozRequestFullScreen) {
        await (target as any).mozRequestFullScreen();
      } else if ((target as any).msRequestFullscreen) {
        await (target as any).msRequestFullscreen();
      }

      // Lock orientation to landscape
      if (lockOrientation && supportsOrientation) {
        try {
          await (screen.orientation as any).lock('landscape');
          setIsLandscape(true);
        } catch (e) {
          console.warn('[AutoFullscreen] Could not lock orientation:', e);
        }
      }

      return true;
    } catch (error) {
      console.warn('[AutoFullscreen] Failed to enter fullscreen:', error);
      return false;
    }
  }, [lockOrientation, supportsOrientation]);

  /**
   * Exit fullscreen mode
   */
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }

      // Unlock orientation
      if (supportsOrientation) {
        try {
          screen.orientation.unlock();
        } catch {}
      }

      return true;
    } catch (error) {
      console.warn('[AutoFullscreen] Failed to exit fullscreen:', error);
      return false;
    }
  }, [supportsOrientation]);

  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(async (element?: HTMLElement) => {
    if (isFullscreen) {
      return await exitFullscreen();
    } else {
      return await enterFullscreen(element);
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  /**
   * Attach container element
   */
  const attachContainer = useCallback((container: HTMLElement) => {
    containerRef.current = container;
  }, []);

  /**
   * Attach video element with auto-fullscreen on play
   */
  const attachVideo = useCallback((video: HTMLVideoElement, container?: HTMLElement) => {
    videoRef.current = video;
    if (container) {
      containerRef.current = container;
    }

    if (!enabled) return () => {};

    const handlePlay = () => {
      if (!isFullscreen && !wasFullscreenRef.current) {
        enterFullscreen(container);
        wasFullscreenRef.current = true;
      }
    };

    const handlePause = () => {
      if (exitOnPause && isFullscreen) {
        exitFullscreen();
      }
    };

    const handleEnded = () => {
      if (isFullscreen) {
        exitFullscreen();
        wasFullscreenRef.current = false;
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [enabled, isFullscreen, exitOnPause, enterFullscreen, exitFullscreen]);

  /**
   * Reset the auto-fullscreen state (for channel switching)
   */
  const reset = useCallback(() => {
    wasFullscreenRef.current = false;
  }, []);

  return {
    // State
    isFullscreen,
    isLandscape,
    supportsFullscreen,
    supportsOrientation,

    // Actions
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    attachContainer,
    attachVideo,
    reset,
  };
}

export default useAutoFullscreen;
