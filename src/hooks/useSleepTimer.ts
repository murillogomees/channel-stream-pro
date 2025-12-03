/**
 * useSleepTimer - Auto-stop playback after X minutes
 * 
 * Allows users to set a timer to automatically stop playback.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSleepTimerOptions {
  onTimerEnd?: () => void;
  onWarning?: (remainingMinutes: number) => void;
  warningMinutes?: number;
}

export function useSleepTimer(options: UseSleepTimerOptions = {}) {
  const { onTimerEnd, onWarning, warningMinutes = 5 } = options;

  const [isActive, setIsActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  
  const intervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const warningShownRef = useRef(false);

  /**
   * Preset options in minutes
   */
  const presets = [15, 30, 45, 60, 90, 120];

  /**
   * Start timer
   */
  const startTimer = useCallback((minutes: number) => {
    if (minutes <= 0) return;

    // Clear existing timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setSelectedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setIsActive(true);
    warningShownRef.current = false;

    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          // Timer ended
          clearInterval(intervalRef.current!);
          setIsActive(false);
          
          // Pause video
          if (videoRef.current) {
            videoRef.current.pause();
          }
          
          onTimerEnd?.();
          return 0;
        }

        const newValue = prev - 1;
        
        // Warning check
        if (!warningShownRef.current && newValue <= warningMinutes * 60 && newValue > (warningMinutes - 1) * 60) {
          warningShownRef.current = true;
          onWarning?.(warningMinutes);
        }

        return newValue;
      });
    }, 1000);
  }, [onTimerEnd, onWarning, warningMinutes]);

  /**
   * Cancel timer
   */
  const cancelTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
    setRemainingSeconds(0);
    setSelectedMinutes(0);
    warningShownRef.current = false;
  }, []);

  /**
   * Add time to existing timer
   */
  const addTime = useCallback((minutes: number) => {
    if (!isActive) {
      startTimer(minutes);
    } else {
      setRemainingSeconds(prev => prev + minutes * 60);
    }
  }, [isActive, startTimer]);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
  }, []);

  /**
   * Format remaining time
   */
  const formatRemaining = useCallback((): string => {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  /**
   * Get progress percentage
   */
  const getProgress = useCallback((): number => {
    if (selectedMinutes === 0) return 0;
    return ((selectedMinutes * 60 - remainingSeconds) / (selectedMinutes * 60)) * 100;
  }, [selectedMinutes, remainingSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    // State
    isActive,
    remainingSeconds,
    selectedMinutes,
    presets,

    // Actions
    startTimer,
    cancelTimer,
    addTime,
    attachVideo,

    // Helpers
    formatRemaining,
    getProgress,
    remainingMinutes: Math.ceil(remainingSeconds / 60),
  };
}

export default useSleepTimer;
