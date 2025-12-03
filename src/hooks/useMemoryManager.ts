/**
 * useMemoryManager - Memory optimization for video player
 * 
 * Features:
 * - Aggressive garbage collection hints
 * - Buffer trimming when memory pressure
 * - Source buffer cleanup
 * - Memory monitoring
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercent: number;
}

interface UseMemoryManagerOptions {
  /** Enable memory management */
  enabled?: boolean;
  /** Memory pressure threshold (0-1) */
  pressureThreshold?: number;
  /** Check interval in ms */
  checkInterval?: number;
  /** Max back buffer in seconds */
  maxBackBuffer?: number;
}

export function useMemoryManager(options: UseMemoryManagerOptions = {}) {
  const {
    enabled = true,
    pressureThreshold = 0.7,
    checkInterval = 5000,
    maxBackBuffer = 30,
  } = options;

  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [isUnderPressure, setIsUnderPressure] = useState(false);
  
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupCount = useRef(0);

  /**
   * Get current memory usage
   */
  const getMemoryStats = useCallback((): MemoryStats | null => {
    // Check if performance.memory is available (Chrome only)
    const perf = performance as any;
    if (!perf.memory) return null;
    
    return {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      usagePercent: perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit,
    };
  }, []);

  /**
   * Trim back buffer aggressively
   */
  const trimBackBuffer = useCallback((video: HTMLVideoElement, maxSeconds: number = 10) => {
    if (!video || video.buffered.length === 0) return;
    
    const currentTime = video.currentTime;
    const sourceBuffer = video as any;
    
    // HLS.js handles this internally, but we can trigger via config
    if (hlsRef.current) {
      // Reduce back buffer dynamically
      hlsRef.current.config.backBufferLength = maxSeconds;
      console.log(`[MemoryManager] Trimmed back buffer to ${maxSeconds}s`);
    }
  }, []);

  /**
   * Request garbage collection (hint only)
   */
  const requestGC = useCallback(() => {
    // Create and discard large objects to hint GC
    // This is a soft suggestion, not guaranteed
    try {
      const temp: any[] = [];
      for (let i = 0; i < 1000; i++) {
        temp.push(new ArrayBuffer(1024));
      }
      temp.length = 0;
    } catch {
      // Ignore if fails
    }
    
    // Force minor GC via timeout trick
    setTimeout(() => {
      // Empty callback can trigger minor GC
    }, 0);
    
    console.log('[MemoryManager] GC hint requested');
  }, []);

  /**
   * Handle memory pressure
   */
  const handleMemoryPressure = useCallback(() => {
    if (!enabled) return;
    
    cleanupCount.current++;
    console.log(`[MemoryManager] Memory pressure detected (cleanup #${cleanupCount.current})`);
    
    // 1. Trim back buffer aggressively
    if (videoRef.current) {
      trimBackBuffer(videoRef.current, 5);
    }
    
    // 2. Lower quality to reduce memory
    if (hlsRef.current && hlsRef.current.levels.length > 1) {
      const currentLevel = hlsRef.current.currentLevel;
      if (currentLevel > 0) {
        hlsRef.current.currentLevel = Math.max(0, currentLevel - 1);
        console.log('[MemoryManager] Reduced quality to save memory');
      }
    }
    
    // 3. Request GC
    requestGC();
    
    setIsUnderPressure(true);
    
    // Reset pressure state after some time
    setTimeout(() => setIsUnderPressure(false), 10000);
  }, [enabled, trimBackBuffer, requestGC]);

  /**
   * Attach to HLS/Video
   */
  const attach = useCallback((hls: Hls, video: HTMLVideoElement) => {
    hlsRef.current = hls;
    videoRef.current = video;
    
    // Configure HLS for memory efficiency
    hls.config.backBufferLength = maxBackBuffer;
    hls.config.maxBufferSize = 30 * 1000 * 1000; // 30MB max buffer
    
    // Monitor HLS buffer growth
    hls.on(Hls.Events.BUFFER_APPENDED, () => {
      const stats = getMemoryStats();
      if (stats && stats.usagePercent > pressureThreshold) {
        handleMemoryPressure();
      }
    });
  }, [maxBackBuffer, pressureThreshold, getMemoryStats, handleMemoryPressure]);

  /**
   * Periodic memory check
   */
  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(() => {
      const stats = getMemoryStats();
      if (stats) {
        setMemoryStats(stats);
        
        if (stats.usagePercent > pressureThreshold && !isUnderPressure) {
          handleMemoryPressure();
        }
      }
    }, checkInterval);
    
    return () => clearInterval(interval);
  }, [enabled, checkInterval, pressureThreshold, getMemoryStats, handleMemoryPressure, isUnderPressure]);

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.load();
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    requestGC();
    console.log('[MemoryManager] Cleanup completed');
  }, [requestGC]);

  /**
   * Get optimized config
   */
  const getConfig = useCallback((): Partial<Hls['config']> => {
    return {
      backBufferLength: maxBackBuffer,
      maxBufferSize: isUnderPressure ? 20 * 1000 * 1000 : 60 * 1000 * 1000,
      maxMaxBufferLength: isUnderPressure ? 30 : 60,
    };
  }, [maxBackBuffer, isUnderPressure]);

  return {
    memoryStats,
    isUnderPressure,
    cleanupCount: cleanupCount.current,
    attach,
    cleanup,
    getConfig,
    trimBackBuffer,
    requestGC,
  };
}

export default useMemoryManager;
