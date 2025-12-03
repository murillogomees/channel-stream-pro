/**
 * usePlayerPerformance - Unified Performance Integration Hook
 * 
 * Centralizes all performance optimizations:
 * - Fast startup with codec detection
 * - Adaptive buffer management
 * - Service Worker caching
 * - Worker-based preloading
 * - Startup time tracking
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useFastStartup } from './useFastStartup';
import { useAdaptiveBuffer } from './useAdaptiveBuffer';
import { useStreamServiceWorker } from './useStreamServiceWorker';
import { useWorkerPreloader } from './useWorkerPreloader';

interface PerformanceMetrics {
  startupTime: number;
  timeToFirstFrame: number;
  manifestLoadTime: number;
  isPreloaded: boolean;
  bufferHealth: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface UsePlayerPerformanceOptions {
  isLive?: boolean;
  enablePreload?: boolean;
}

export function usePlayerPerformance(options: UsePlayerPerformanceOptions = {}) {
  const { isLive = true, enablePreload = true } = options;
  
  // Sub-hooks
  const fastStartup = useFastStartup();
  const adaptiveBuffer = useAdaptiveBuffer({ isLive });
  const streamSW = useStreamServiceWorker();
  const workerPreloader = useWorkerPreloader({ enabled: enablePreload });
  
  // Timing refs
  const startTimeRef = useRef<number>(0);
  const manifestLoadTimeRef = useRef<number>(0);
  const firstFrameTimeRef = useRef<number>(0);
  
  // Metrics state
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    startupTime: 0,
    timeToFirstFrame: 0,
    manifestLoadTime: 0,
    isPreloaded: false,
    bufferHealth: 100,
    connectionQuality: 'good',
  });

  /**
   * Start timing measurement
   */
  const startTiming = useCallback(() => {
    startTimeRef.current = performance.now();
    manifestLoadTimeRef.current = 0;
    firstFrameTimeRef.current = 0;
  }, []);

  /**
   * Record manifest loaded time
   */
  const recordManifestLoaded = useCallback(() => {
    if (startTimeRef.current > 0) {
      manifestLoadTimeRef.current = performance.now() - startTimeRef.current;
      setMetrics(prev => ({
        ...prev,
        manifestLoadTime: manifestLoadTimeRef.current,
      }));
      console.log(`[Performance] Manifest loaded in ${manifestLoadTimeRef.current.toFixed(0)}ms`);
    }
  }, []);

  /**
   * Record first frame time
   */
  const recordFirstFrame = useCallback(() => {
    if (startTimeRef.current > 0 && firstFrameTimeRef.current === 0) {
      firstFrameTimeRef.current = performance.now() - startTimeRef.current;
      setMetrics(prev => ({
        ...prev,
        timeToFirstFrame: firstFrameTimeRef.current,
        startupTime: firstFrameTimeRef.current,
      }));
      console.log(`[Performance] First frame in ${firstFrameTimeRef.current.toFixed(0)}ms`);
    }
  }, []);

  /**
   * Get optimized HLS configuration
   */
  const getOptimizedHlsConfig = useCallback((): Partial<Hls['config']> => {
    const fastConfig = fastStartup.getOptimalHlsConfig();
    const bufferConfig = adaptiveBuffer.getHlsConfig;
    
    return {
      ...bufferConfig,
      ...fastConfig,
      
      // Performance overrides
      enableWorker: true,
      startFragPrefetch: true,
      progressive: true,
      
      // Fast startup
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,
      
      // Buffer stability
      maxBufferLength: isLive ? 30 : 60,
      maxMaxBufferLength: isLive ? 60 : 120,
      
      // Network resilience
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 500,
      manifestLoadingMaxRetry: 4,
      
      // Live optimizations
      ...(isLive ? {
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        lowLatencyMode: false,
        liveDurationInfinity: true,
      } : {}),
    };
  }, [fastStartup, adaptiveBuffer.getHlsConfig, isLive]);

  /**
   * Preload a stream URL
   */
  const preloadStream = useCallback(async (url: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<boolean> => {
    if (!enablePreload) return false;
    
    // Try worker preloader first
    const result = await workerPreloader.preloadManifest(url, priority);
    
    // Also prefetch via Service Worker
    if (streamSW.isRegistered) {
      await streamSW.prefetch(url);
    }
    
    return result.success;
  }, [enablePreload, workerPreloader, streamSW]);

  /**
   * Preload multiple streams (adjacent channels)
   */
  const preloadBatch = useCallback(async (urls: Array<{ url: string; priority: 'high' | 'medium' | 'low' }>) => {
    if (!enablePreload || urls.length === 0) return;
    
    await workerPreloader.preloadBatch(urls);
  }, [enablePreload, workerPreloader]);

  /**
   * Check if URL is preloaded/cached
   */
  const isUrlPreloaded = useCallback((url: string): boolean => {
    return workerPreloader.isCached(url);
  }, [workerPreloader]);

  /**
   * Get cached manifest data
   */
  const getCachedManifest = useCallback((url: string): string | null => {
    return workerPreloader.getCachedManifest(url);
  }, [workerPreloader]);

  /**
   * Attach HLS instance for adaptive buffer management
   */
  const attachHls = useCallback((hls: Hls, video: HTMLVideoElement) => {
    adaptiveBuffer.attachHls(hls);
    adaptiveBuffer.attachVideo(video);
  }, [adaptiveBuffer]);

  /**
   * Detach and cleanup
   */
  const detach = useCallback(() => {
    adaptiveBuffer.detach();
  }, [adaptiveBuffer]);

  /**
   * Run preflight check for URL
   */
  const preflightCheck = useCallback(async (url: string) => {
    return fastStartup.preflightCheck(url);
  }, [fastStartup]);

  /**
   * Update connection quality based on buffer stats
   */
  useEffect(() => {
    const quality = adaptiveBuffer.stats.avgBufferHealth >= 90 
      ? 'excellent' 
      : adaptiveBuffer.stats.avgBufferHealth >= 70 
        ? 'good' 
        : adaptiveBuffer.stats.avgBufferHealth >= 50 
          ? 'fair' 
          : 'poor';
    
    setMetrics(prev => ({
      ...prev,
      bufferHealth: adaptiveBuffer.stats.avgBufferHealth,
      connectionQuality: quality,
    }));
  }, [adaptiveBuffer.stats.avgBufferHealth]);

  return {
    // Timing
    startTiming,
    recordManifestLoaded,
    recordFirstFrame,
    
    // Configuration
    getOptimizedHlsConfig,
    
    // Preloading
    preloadStream,
    preloadBatch,
    isUrlPreloaded,
    getCachedManifest,
    
    // HLS integration
    attachHls,
    detach,
    preflightCheck,
    
    // Metrics
    metrics,
    bufferStats: adaptiveBuffer.stats,
    deviceCapabilities: fastStartup.deviceCapabilities,
    codecSupport: fastStartup.codecSupport,
    
    // Status
    isServiceWorkerActive: streamSW.isRegistered,
    isWorkerReady: workerPreloader.isReady,
    isAnalyzing: fastStartup.isAnalyzing,
    
    // Service Worker stats
    swStats: streamSW.stats,
  };
}

export default usePlayerPerformance;
