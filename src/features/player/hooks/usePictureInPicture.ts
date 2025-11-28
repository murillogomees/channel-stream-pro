/**
 * usePictureInPicture - Hook for PIP functionality
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface UsePIPOptions {
  onEnter?: () => void;
  onExit?: () => void;
  onError?: (error: Error) => void;
}

export function usePictureInPicture(options: UsePIPOptions = {}) {
  const { onEnter, onExit, onError } = options;
  
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check PIP support on mount
  useEffect(() => {
    const supported = 'pictureInPictureEnabled' in document && 
      (document as any).pictureInPictureEnabled;
    setIsSupported(supported);
  }, []);

  // Register video element
  const registerVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    
    if (!video) return;

    // Listen for PIP events
    const handleEnterPIP = () => {
      setIsActive(true);
      onEnter?.();
    };

    const handleExitPIP = () => {
      setIsActive(false);
      onExit?.();
    };

    video.addEventListener('enterpictureinpicture', handleEnterPIP);
    video.addEventListener('leavepictureinpicture', handleExitPIP);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPIP);
      video.removeEventListener('leavepictureinpicture', handleExitPIP);
    };
  }, [onEnter, onExit]);

  // Enter PIP mode
  const enterPIP = useCallback(async () => {
    if (!videoRef.current || !isSupported) {
      onError?.(new Error('PIP não suportado'));
      return false;
    }

    try {
      // Check if video is ready
      if (videoRef.current.readyState < 2) {
        onError?.(new Error('Vídeo ainda não carregado'));
        return false;
      }

      await videoRef.current.requestPictureInPicture();
      return true;
    } catch (error: any) {
      console.error('[PIP] Error entering:', error);
      onError?.(error);
      return false;
    }
  }, [isSupported, onError]);

  // Exit PIP mode
  const exitPIP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('[PIP] Error exiting:', error);
      onError?.(error);
      return false;
    }
  }, [onError]);

  // Toggle PIP
  const togglePIP = useCallback(async () => {
    if (isActive) {
      return exitPIP();
    }
    return enterPIP();
  }, [isActive, enterPIP, exitPIP]);

  // Check if currently in PIP
  useEffect(() => {
    const checkPIP = () => {
      const inPIP = !!document.pictureInPictureElement;
      setIsActive(inPIP);
    };

    checkPIP();

    // Listen for changes
    document.addEventListener('fullscreenchange', checkPIP);
    
    return () => {
      document.removeEventListener('fullscreenchange', checkPIP);
    };
  }, []);

  return {
    isSupported,
    isActive,
    registerVideo,
    enterPIP,
    exitPIP,
    togglePIP,
  };
}
