/**
 * Touch Gestures Hook
 * 
 * Provides swipe gestures for volume, brightness, and seek on mobile
 */

import { useCallback, useRef, useState } from 'react';

export interface TouchGestureConfig {
  enabled: boolean;
  sensitivityVolume: number;   // pixels per 1% change
  sensitivityBrightness: number;
  sensitivitySeek: number;     // pixels per second
  deadzone: number;            // minimum movement to trigger
}

export interface GestureState {
  isGesturing: boolean;
  gestureType: 'none' | 'volume' | 'brightness' | 'seek';
  gestureValue: number;
  displayValue: string;
}

const DEFAULT_CONFIG: TouchGestureConfig = {
  enabled: true,
  sensitivityVolume: 3,
  sensitivityBrightness: 3,
  sensitivitySeek: 2,
  deadzone: 10,
};

interface UseGesturesOptions {
  config?: Partial<TouchGestureConfig>;
  onVolumeChange?: (delta: number) => void;
  onBrightnessChange?: (delta: number) => void;
  onSeek?: (delta: number) => void;
}

export function useTouchGestures(options: UseGesturesOptions = {}) {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  
  const [gestureState, setGestureState] = useState<GestureState>({
    isGesturing: false,
    gestureType: 'none',
    gestureValue: 0,
    displayValue: '',
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialVolumeRef = useRef(1);
  const initialBrightnessRef = useRef(100);
  const gestureLockedRef = useRef<'none' | 'vertical' | 'horizontal'>('none');
  const containerWidthRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent, containerWidth: number, currentVolume: number, currentBrightness: number) => {
    if (!config.enabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    containerWidthRef.current = containerWidth;
    initialVolumeRef.current = currentVolume;
    initialBrightnessRef.current = currentBrightness;
    gestureLockedRef.current = 'none';
  }, [config.enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!config.enabled || !touchStartRef.current || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine gesture direction if not locked
    if (gestureLockedRef.current === 'none') {
      if (absX < config.deadzone && absY < config.deadzone) return;
      
      gestureLockedRef.current = absY > absX ? 'vertical' : 'horizontal';
    }

    if (gestureLockedRef.current === 'vertical') {
      // Vertical gesture - left side = brightness, right side = volume
      const isLeftSide = touchStartRef.current.x < containerWidthRef.current / 2;
      const volumeChange = -deltaY / config.sensitivityVolume;
      const brightnessChange = -deltaY / config.sensitivityBrightness;

      if (isLeftSide) {
        const newBrightness = Math.max(0, Math.min(200, initialBrightnessRef.current + brightnessChange));
        options.onBrightnessChange?.(newBrightness - initialBrightnessRef.current);
        
        setGestureState({
          isGesturing: true,
          gestureType: 'brightness',
          gestureValue: newBrightness,
          displayValue: `☀️ ${Math.round(newBrightness)}%`,
        });
      } else {
        const newVolume = Math.max(0, Math.min(100, initialVolumeRef.current * 100 + volumeChange));
        options.onVolumeChange?.((newVolume - initialVolumeRef.current * 100) / 100);
        
        setGestureState({
          isGesturing: true,
          gestureType: 'volume',
          gestureValue: newVolume,
          displayValue: `🔊 ${Math.round(newVolume)}%`,
        });
      }
    } else {
      // Horizontal gesture - seek
      const seekSeconds = deltaX / config.sensitivitySeek;
      options.onSeek?.(seekSeconds);
      
      const sign = seekSeconds >= 0 ? '+' : '';
      setGestureState({
        isGesturing: true,
        gestureType: 'seek',
        gestureValue: seekSeconds,
        displayValue: `${sign}${Math.round(seekSeconds)}s`,
      });
    }
  }, [config, options]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    gestureLockedRef.current = 'none';
    
    // Delay hiding the gesture indicator
    setTimeout(() => {
      setGestureState({
        isGesturing: false,
        gestureType: 'none',
        gestureValue: 0,
        displayValue: '',
      });
    }, 300);
  }, []);

  // Double tap detection for seeking
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  
  const handleDoubleTap = useCallback((e: React.TouchEvent, onSeekLeft: () => void, onSeekRight: () => void) => {
    if (!config.enabled || e.touches.length !== 1) return false;

    const touch = e.changedTouches[0];
    const now = Date.now();
    
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      // Double tap detected
      const isLeftSide = touch.clientX < containerWidthRef.current / 2;
      if (isLeftSide) {
        onSeekLeft();
      } else {
        onSeekRight();
      }
      lastTapRef.current = null;
      return true;
    }
    
    lastTapRef.current = { time: now, x: touch.clientX };
    return false;
  }, [config.enabled]);

  return {
    gestureState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDoubleTap,
  };
}

export default useTouchGestures;
