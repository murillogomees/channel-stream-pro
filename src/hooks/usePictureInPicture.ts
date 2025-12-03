/**
 * usePictureInPicture - Picture-in-Picture Support
 * 
 * Allows video to float while navigating the app.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface UsePictureInPictureOptions {
  onEnter?: () => void;
  onExit?: () => void;
  onError?: (error: Error) => void;
}

export function usePictureInPicture(options: UsePictureInPictureOptions = {}) {
  const { onEnter, onExit, onError } = options;
  
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check PiP support
  useEffect(() => {
    const supported = 'pictureInPictureEnabled' in document && 
      (document as any).pictureInPictureEnabled;
    setIsSupported(supported);
  }, []);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Listen for PiP events
    const handleEnter = () => {
      setIsActive(true);
      onEnter?.();
    };

    const handleExit = () => {
      setIsActive(false);
      onExit?.();
    };

    video.addEventListener('enterpictureinpicture', handleEnter);
    video.addEventListener('leavepictureinpicture', handleExit);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnter);
      video.removeEventListener('leavepictureinpicture', handleExit);
    };
  }, [onEnter, onExit]);

  /**
   * Enter Picture-in-Picture mode
   */
  const enterPiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isSupported) return false;

    try {
      // Check if already in PiP
      if ((document as any).pictureInPictureElement === video) {
        return true;
      }

      // Request PiP
      await (video as any).requestPictureInPicture();
      return true;
    } catch (error) {
      console.error('[PiP] Failed to enter:', error);
      onError?.(error as Error);
      return false;
    }
  }, [isSupported, onError]);

  /**
   * Exit Picture-in-Picture mode
   */
  const exitPiP = useCallback(async () => {
    if (!isSupported) return false;

    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
      }
      return true;
    } catch (error) {
      console.error('[PiP] Failed to exit:', error);
      onError?.(error as Error);
      return false;
    }
  }, [isSupported, onError]);

  /**
   * Toggle Picture-in-Picture mode
   */
  const togglePiP = useCallback(async () => {
    if (isActive) {
      return await exitPiP();
    } else {
      return await enterPiP();
    }
  }, [isActive, enterPiP, exitPiP]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActive) {
        exitPiP();
      }
    };
  }, [isActive, exitPiP]);

  return {
    isSupported,
    isActive,
    attachVideo,
    enterPiP,
    exitPiP,
    togglePiP,
  };
}

export default usePictureInPicture;
