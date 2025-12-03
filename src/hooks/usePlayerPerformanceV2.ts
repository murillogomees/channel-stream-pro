/**
 * usePlayerPerformanceV2 - Unified performance optimization hook
 * 
 * Combines:
 * - Fast startup
 * - Smart buffer
 * - Memory management
 * - Frame drop prevention
 */

import { useCallback, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import { useFastStartupV2 } from './useFastStartupV2';
import { useSmartBuffer } from './useSmartBuffer';
import { useMemoryManager } from './useMemoryManager';
import { useFrameDropPrevention } from './useFrameDropPrevention';

interface UsePlayerPerformanceV2Options {
  /** Enable all optimizations */
  enabled?: boolean;
  /** Is live stream */
  isLive?: boolean;
  /** CDN domains for preconnect */
  cdnDomains?: string[];
}

export interface PerformanceMetrics {
  // Startup
  ttff: number;
  
  // Buffer
  networkQuality: string;
  bufferHealth: number;
  stallCount: number;
  
  // Memory
  memoryUsage: number | null;
  isMemoryPressure: boolean;
  
  // Frames
  fps: number;
  dropRate: number;
  performanceScore: number;
}

export function usePlayerPerformanceV2(options: UsePlayerPerformanceV2Options = {}) {
  const {
    enabled = true,
    isLive = false,
    cdnDomains = [],
  } = options;

  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sub-hooks
  const fastStartup = useFastStartupV2({
    startLowQuality: true,
    upgradeDelay: isLive ? 2 : 3,
    preconnectDomains: cdnDomains,
  });

  const smartBuffer = useSmartBuffer({
    enabled,
    minBuffer: isLive ? 10 : 20,
    maxBuffer: isLive ? 30 : 120,
  });

  const memoryManager = useMemoryManager({
    enabled,
    pressureThreshold: 0.7,
    maxBackBuffer: isLive ? 15 : 30,
  });

  const frameDropPrevention = useFrameDropPrevention({
    enabled,
    maxDropRate: 0.03,
    targetFPS: 30,
  });

  /**
   * Get merged optimized HLS config
   */
  const getOptimizedConfig = useCallback((): Partial<Hls['config']> => {
    const startupConfig = fastStartup.getConfig();
    const bufferConfig = smartBuffer.getConfig();
    const memoryConfig = memoryManager.getConfig();
    const frameConfig = frameDropPrevention.getConfig();

    return {
      // Startup optimizations
      ...startupConfig,
      
      // Buffer management (smart buffer takes precedence)
      ...bufferConfig,
      
      // Memory constraints
      ...memoryConfig,
      
      // Frame drop prevention
      ...frameConfig,
      
      // Common optimizations
      enableWorker: true,
      lowLatencyMode: isLive,
      progressive: !isLive,
      
      // Error handling
      fragLoadingMaxRetry: 4,
      manifestLoadingMaxRetry: 3,
      levelLoadingMaxRetry: 3,
    };
  }, [fastStartup, smartBuffer, memoryManager, frameDropPrevention, isLive]);

  /**
   * Attach all systems to HLS/Video
   */
  const attach = useCallback((hls: Hls, video: HTMLVideoElement) => {
    hlsRef.current = hls;
    videoRef.current = video;

    // Attach all sub-systems
    fastStartup.attach(hls, video);
    smartBuffer.attach(hls, video);
    memoryManager.attach(hls, video);
    frameDropPrevention.attach(hls, video);

    console.log('[PerformanceV2] All systems attached');
  }, [fastStartup, smartBuffer, memoryManager, frameDropPrevention]);

  /**
   * Cleanup all systems
   */
  const cleanup = useCallback(() => {
    memoryManager.cleanup();
    fastStartup.reset();
    smartBuffer.reset();
    frameDropPrevention.reset();
    
    hlsRef.current = null;
    videoRef.current = null;
    
    console.log('[PerformanceV2] Cleanup completed');
  }, [memoryManager, fastStartup, smartBuffer, frameDropPrevention]);

  /**
   * Get current performance metrics
   */
  const getMetrics = useCallback((): PerformanceMetrics => {
    return {
      // Startup
      ttff: fastStartup.getTTFF(),
      
      // Buffer
      networkQuality: smartBuffer.networkQuality,
      bufferHealth: smartBuffer.bufferHealth,
      stallCount: smartBuffer.stallCount,
      
      // Memory
      memoryUsage: memoryManager.memoryStats?.usagePercent ?? null,
      isMemoryPressure: memoryManager.isUnderPressure,
      
      // Frames
      fps: frameDropPrevention.frameStats.currentFPS,
      dropRate: frameDropPrevention.frameStats.dropRate,
      performanceScore: frameDropPrevention.performanceScore,
    };
  }, [fastStartup, smartBuffer, memoryManager, frameDropPrevention]);

  /**
   * Overall health status
   */
  const healthStatus = useMemo(() => {
    const score = frameDropPrevention.performanceScore;
    const bufferHealth = smartBuffer.bufferHealth;
    const memoryPressure = memoryManager.isUnderPressure;
    
    if (memoryPressure || score < 50 || bufferHealth < 30) return 'critical';
    if (score < 70 || bufferHealth < 50) return 'warning';
    if (score < 85 || bufferHealth < 70) return 'fair';
    return 'good';
  }, [frameDropPrevention.performanceScore, smartBuffer.bufferHealth, memoryManager.isUnderPressure]);

  return {
    // Config
    getOptimizedConfig,
    
    // Lifecycle
    attach,
    cleanup,
    
    // Metrics
    getMetrics,
    healthStatus,
    
    // Individual systems (for advanced usage)
    fastStartup,
    smartBuffer,
    memoryManager,
    frameDropPrevention,
  };
}

export default usePlayerPerformanceV2;
