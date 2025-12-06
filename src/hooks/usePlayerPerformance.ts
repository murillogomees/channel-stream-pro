/**
 * usePlayerPerformance - CONSOLIDATED (wrapper for usePlayerPerformanceV2)
 * 
 * @deprecated Use usePlayerPerformanceV2 directly for new code
 * This wrapper maintains backward compatibility while delegating to V2
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { usePlayerPerformanceV2 } from './usePlayerPerformanceV2';
import { useFastStartup } from './useFastStartup';
import { useStreamServiceWorker } from './useStreamServiceWorker';

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

/**
 * @deprecated Use usePlayerPerformanceV2 directly
 */
export function usePlayerPerformance(options: UsePlayerPerformanceOptions = {}) {
  const { isLive = true, enablePreload = true } = options;
  
  // Delegate to V2
  const v2 = usePlayerPerformanceV2({
    enabled: true,
    isLive,
    cdnDomains: [],
  });
  
  // Legacy hooks for compatibility
  const fastStartup = useFastStartup();
  const streamSW = useStreamServiceWorker();
  
  // Timing refs
  const startTimeRef = useRef<number>(0);
  const manifestLoadTimeRef = useRef<number>(0);
  const firstFrameTimeRef = useRef<number>(0);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    startupTime: 0,
    timeToFirstFrame: 0,
    manifestLoadTime: 0,
    isPreloaded: false,
    bufferHealth: 100,
    connectionQuality: 'good',
  });

  const startTiming = useCallback(() => {
    startTimeRef.current = performance.now();
    manifestLoadTimeRef.current = 0;
    firstFrameTimeRef.current = 0;
  }, []);

  const recordManifestLoaded = useCallback(() => {
    if (startTimeRef.current > 0) {
      manifestLoadTimeRef.current = performance.now() - startTimeRef.current;
      setMetrics(prev => ({ ...prev, manifestLoadTime: manifestLoadTimeRef.current }));
    }
  }, []);

  const recordFirstFrame = useCallback(() => {
    if (startTimeRef.current > 0 && firstFrameTimeRef.current === 0) {
      firstFrameTimeRef.current = performance.now() - startTimeRef.current;
      setMetrics(prev => ({
        ...prev,
        timeToFirstFrame: firstFrameTimeRef.current,
        startupTime: firstFrameTimeRef.current,
      }));
    }
  }, []);

  const getOptimizedHlsConfig = useCallback((): Partial<Hls['config']> => {
    // Delegate to V2's optimized config
    return v2.getOptimizedConfig();
  }, [v2]);

  const preloadStream = useCallback(async (url: string, _priority?: 'high' | 'medium' | 'low'): Promise<boolean> => {
    if (!enablePreload) return false;
    if (streamSW.isRegistered) {
      await streamSW.prefetch(url);
      return true;
    }
    return false;
  }, [enablePreload, streamSW]);

  const preloadBatch = useCallback(async (urls: Array<{ url: string; priority: 'high' | 'medium' | 'low' }>) => {
    if (!enablePreload || urls.length === 0) return;
    await Promise.all(urls.slice(0, 3).map(u => preloadStream(u.url, u.priority)));
  }, [enablePreload, preloadStream]);

  const isUrlPreloaded = useCallback((_url: string): boolean => false, []);
  const getCachedManifest = useCallback((_url: string): string | null => null, []);

  const attachHls = useCallback((hls: Hls, video: HTMLVideoElement) => {
    v2.attach(hls, video);
  }, [v2]);

  const detach = useCallback(() => {
    v2.cleanup();
  }, [v2]);

  const preflightCheck = useCallback(async (url: string) => {
    return fastStartup.preflightCheck(url);
  }, [fastStartup]);

  // Derive health status
  const healthToQuality = useMemo(() => {
    const status = v2.healthStatus;
    if (status === 'good') return 'excellent';
    if (status === 'fair') return 'good';
    if (status === 'warning') return 'fair';
    return 'poor';
  }, [v2.healthStatus]);

  const bufferStats = useMemo(() => {
    const m = v2.getMetrics();
    return {
      avgBufferHealth: m.bufferHealth,
      currentBuffer: m.bufferHealth,
      connectionQuality: healthToQuality,
      stallCount: 0,
    };
  }, [v2, healthToQuality]);

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
    metrics: {
      ...metrics,
      bufferHealth: v2.getMetrics().bufferHealth,
      connectionQuality: healthToQuality,
    },
    bufferStats,
    deviceCapabilities: fastStartup.deviceCapabilities,
    codecSupport: fastStartup.codecSupport,
    
    // Status
    isServiceWorkerActive: streamSW.isRegistered,
    isWorkerReady: true,
    isAnalyzing: fastStartup.isAnalyzing,
    
    // SW stats
    swStats: streamSW.stats,
  };
}

export default usePlayerPerformance;
