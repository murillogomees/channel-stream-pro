/**
 * useDoubleTapSeek - Double tap to seek (YouTube style)
 * 
 * Double tap left side to rewind, right side to forward.
 */

import { useState, useCallback, useRef } from 'react';

interface DoubleTapState {
  isActive: boolean;
  side: 'left' | 'right' | null;
  seekAmount: number;
  tapCount: number;
  x: number;
  y: number;
}

interface UseDoubleTapSeekOptions {
  enabled?: boolean;
  seekAmount?: number;           // Seconds per double tap
  doubleTapDelay?: number;       // Max ms between taps
  tapZoneRatio?: number;         // Ratio of screen for tap zones (0.3 = 30% each side)
  onSeek?: (seconds: number) => void;
  onDoubleTap?: (side: 'left' | 'right', totalSeek: number) => void;
}

const DEFAULT_OPTIONS: UseDoubleTapSeekOptions = {
  enabled: true,
  seekAmount: 10,
  doubleTapDelay: 300,
  tapZoneRatio: 0.35,
};

export function useDoubleTapSeek(options: UseDoubleTapSeekOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<DoubleTapState>({
    isActive: false,
    side: null,
    seekAmount: 0,
    tapCount: 0,
    x: 0,
    y: 0,
  });

  const containerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; side: 'left' | 'right' | 'center' } | null>(null);
  const consecutiveTapsRef = useRef(0);
  const hideTimeoutRef = useRef<number | null>(null);
  const totalSeekRef = useRef(0);

  /**
   * Determine tap zone
   */
  const getTapZone = useCallback((x: number, containerWidth: number): 'left' | 'right' | 'center' => {
    const leftBoundary = containerWidth * config.tapZoneRatio!;
    const rightBoundary = containerWidth * (1 - config.tapZoneRatio!);

    if (x < leftBoundary) return 'left';
    if (x > rightBoundary) return 'right';
    return 'center';
  }, [config.tapZoneRatio]);

  /**
   * Execute seek
   */
  const executeSeek = useCallback((side: 'left' | 'right', taps: number) => {
    const video = videoRef.current;
    if (!video) return;

    const seekSeconds = config.seekAmount! * taps * (side === 'left' ? -1 : 1);
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seekSeconds));
    
    totalSeekRef.current += seekSeconds;
    config.onSeek?.(seekSeconds);
    config.onDoubleTap?.(side, totalSeekRef.current);
  }, [config]);

  /**
   * Handle tap
   */
  const handleTap = useCallback((e: MouseEvent | TouchEvent) => {
    if (!config.enabled) return;

    const container = containerRef.current;
    if (!container) return;

    // Get tap position
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ((e as TouchEvent).changedTouches?.length > 0) {
        clientX = (e as TouchEvent).changedTouches[0].clientX;
        clientY = (e as TouchEvent).changedTouches[0].clientY;
      } else {
        return;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const side = getTapZone(x, rect.width);

    // Center tap - ignore for seeking
    if (side === 'center') {
      lastTapRef.current = null;
      consecutiveTapsRef.current = 0;
      return;
    }

    const now = Date.now();
    const lastTap = lastTapRef.current;

    // Check for double tap
    if (lastTap && 
        now - lastTap.time < config.doubleTapDelay! && 
        lastTap.side === side) {
      // Double tap detected!
      e.preventDefault();
      e.stopPropagation();

      consecutiveTapsRef.current++;
      
      // Clear existing hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Update state
      setState({
        isActive: true,
        side,
        seekAmount: config.seekAmount! * consecutiveTapsRef.current,
        tapCount: consecutiveTapsRef.current,
        x,
        y,
      });

      // Execute seek
      executeSeek(side, 1);

      // Hide indicator after delay
      hideTimeoutRef.current = window.setTimeout(() => {
        setState(prev => ({ ...prev, isActive: false }));
        consecutiveTapsRef.current = 0;
        totalSeekRef.current = 0;
      }, 800);

      // Update last tap
      lastTapRef.current = { time: now, x, side };
    } else {
      // First tap - wait for potential second tap
      lastTapRef.current = { time: now, x, side };
      consecutiveTapsRef.current = 0;
      totalSeekRef.current = 0;
    }
  }, [config, getTapZone, executeSeek]);

  /**
   * Attach container element
   */
  const attachContainer = useCallback((container: HTMLElement) => {
    containerRef.current = container;

    // Use click for mouse, touchend for touch
    container.addEventListener('click', handleTap);
    container.addEventListener('touchend', handleTap);

    return () => {
      container.removeEventListener('click', handleTap);
      container.removeEventListener('touchend', handleTap);
      
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [handleTap]);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isActive: false,
      side: null,
      seekAmount: 0,
      tapCount: 0,
      x: 0,
      y: 0,
    });
    consecutiveTapsRef.current = 0;
    totalSeekRef.current = 0;
    lastTapRef.current = null;
  }, []);

  return {
    // State
    state,
    isActive: state.isActive,
    side: state.side,
    seekAmount: state.seekAmount,
    tapCount: state.tapCount,

    // Actions
    attachContainer,
    attachVideo,
    reset,
  };
}

export default useDoubleTapSeek;
