/**
 * useMobileGestures - Touch gestures for video player
 * 
 * Swipe gestures for volume, brightness, and seeking (YouTube/VLC style)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface GestureState {
  isActive: boolean;
  type: 'volume' | 'brightness' | 'seek' | null;
  startValue: number;
  currentValue: number;
  delta: number;
}

interface UseMobileGesturesOptions {
  enabled?: boolean;
  volumeSensitivity?: number;
  brightnessSensitivity?: number;
  seekSensitivity?: number;
  minSwipeDistance?: number;
  onVolumeChange?: (volume: number) => void;
  onBrightnessChange?: (brightness: number) => void;
  onSeek?: (deltaSeconds: number) => void;
  onGestureStart?: (type: GestureState['type']) => void;
  onGestureEnd?: () => void;
}

const DEFAULT_OPTIONS: UseMobileGesturesOptions = {
  enabled: true,
  volumeSensitivity: 0.005,
  brightnessSensitivity: 0.005,
  seekSensitivity: 0.5,
  minSwipeDistance: 20,
};

export function useMobileGestures(options: UseMobileGesturesOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    type: null,
    startValue: 0,
    currentValue: 0,
    delta: 0,
  });

  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);

  const containerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const gestureTypeRef = useRef<GestureState['type']>(null);
  const initialValueRef = useRef(0);

  /**
   * Determine gesture type based on touch position and movement
   */
  const determineGestureType = useCallback((
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    containerWidth: number
  ): GestureState['type'] => {
    const deltaX = Math.abs(currentX - startX);
    const deltaY = Math.abs(currentY - startY);

    // Horizontal swipe = seek
    if (deltaX > deltaY && deltaX > config.minSwipeDistance!) {
      return 'seek';
    }

    // Vertical swipe
    if (deltaY > deltaX && deltaY > config.minSwipeDistance!) {
      // Left side = brightness, right side = volume
      return startX < containerWidth / 2 ? 'brightness' : 'volume';
    }

    return null;
  }, [config.minSwipeDistance]);

  /**
   * Handle touch start
   */
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!config.enabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    gestureTypeRef.current = null;
    
    // Store initial values
    if (videoRef.current) {
      initialValueRef.current = videoRef.current.volume;
    }
  }, [config.enabled]);

  /**
   * Handle touch move
   */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!config.enabled || !touchStartRef.current || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const startX = touchStartRef.current.x - containerRect.left;
    const startY = touchStartRef.current.y - containerRect.top;
    const currentX = touch.clientX - containerRect.left;
    const currentY = touch.clientY - containerRect.top;

    // Determine gesture type if not already set
    if (!gestureTypeRef.current) {
      const type = determineGestureType(startX, startY, currentX, currentY, containerRect.width);
      if (type) {
        gestureTypeRef.current = type;
        config.onGestureStart?.(type);
        
        setGestureState({
          isActive: true,
          type,
          startValue: type === 'volume' ? volume : type === 'brightness' ? brightness : 0,
          currentValue: type === 'volume' ? volume : type === 'brightness' ? brightness : 0,
          delta: 0,
        });
      }
    }

    // Process gesture
    if (gestureTypeRef.current) {
      e.preventDefault();

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touchStartRef.current.y - touch.clientY; // Inverted for natural feel

      switch (gestureTypeRef.current) {
        case 'volume': {
          const newVolume = Math.max(0, Math.min(1, volume + deltaY * config.volumeSensitivity!));
          setVolume(newVolume);
          if (videoRef.current) {
            videoRef.current.volume = newVolume;
          }
          config.onVolumeChange?.(newVolume);
          setGestureState(prev => ({
            ...prev,
            currentValue: newVolume,
            delta: newVolume - prev.startValue,
          }));
          break;
        }

        case 'brightness': {
          const newBrightness = Math.max(0.2, Math.min(1, brightness + deltaY * config.brightnessSensitivity!));
          setBrightness(newBrightness);
          if (videoRef.current) {
            videoRef.current.style.filter = `brightness(${newBrightness})`;
          }
          config.onBrightnessChange?.(newBrightness);
          setGestureState(prev => ({
            ...prev,
            currentValue: newBrightness,
            delta: newBrightness - prev.startValue,
          }));
          break;
        }

        case 'seek': {
          const seekDelta = deltaX * config.seekSensitivity!;
          setGestureState(prev => ({
            ...prev,
            delta: seekDelta,
          }));
          break;
        }
      }
    }
  }, [config, volume, brightness, determineGestureType]);

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(() => {
    if (gestureTypeRef.current === 'seek' && gestureState.delta !== 0) {
      config.onSeek?.(gestureState.delta);
      if (videoRef.current) {
        videoRef.current.currentTime += gestureState.delta;
      }
    }

    config.onGestureEnd?.();
    
    setGestureState({
      isActive: false,
      type: null,
      startValue: 0,
      currentValue: 0,
      delta: 0,
    });

    touchStartRef.current = null;
    gestureTypeRef.current = null;
  }, [config, gestureState.delta]);

  /**
   * Attach container element
   */
  const attachContainer = useCallback((container: HTMLElement) => {
    containerRef.current = container;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    setVolume(video.volume);
  }, []);

  /**
   * Format gesture indicator text
   */
  const getIndicatorText = useCallback((): string => {
    switch (gestureState.type) {
      case 'volume':
        return `Volume: ${Math.round(gestureState.currentValue * 100)}%`;
      case 'brightness':
        return `Brilho: ${Math.round(gestureState.currentValue * 100)}%`;
      case 'seek':
        const sign = gestureState.delta >= 0 ? '+' : '';
        return `${sign}${Math.round(gestureState.delta)}s`;
      default:
        return '';
    }
  }, [gestureState]);

  return {
    // State
    gestureState,
    volume,
    brightness,

    // Actions
    attachContainer,
    attachVideo,
    
    // Helpers
    getIndicatorText,
    isGestureActive: gestureState.isActive,
    gestureType: gestureState.type,
  };
}

export default useMobileGestures;
