/**
 * useFrameDropPrevention - Prevents frame dropping on weak devices
 * 
 * Features:
 * - Monitor dropped frames in real-time
 * - Auto-reduce quality when dropping detected
 * - Hardware decode detection
 * - Performance scoring
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

interface FrameStats {
  totalFrames: number;
  droppedFrames: number;
  dropRate: number;
  currentFPS: number;
  targetFPS: number;
}

interface UseFrameDropPreventionOptions {
  /** Enable frame drop prevention */
  enabled?: boolean;
  /** Max acceptable drop rate (0-1) */
  maxDropRate?: number;
  /** Check interval in ms */
  checkInterval?: number;
  /** Target FPS */
  targetFPS?: number;
}

export function useFrameDropPrevention(options: UseFrameDropPreventionOptions = {}) {
  const {
    enabled = true,
    maxDropRate = 0.05, // 5% max drop rate
    checkInterval = 1000,
    targetFPS = 30,
  } = options;

  const [frameStats, setFrameStats] = useState<FrameStats>({
    totalFrames: 0,
    droppedFrames: 0,
    dropRate: 0,
    currentFPS: 0,
    targetFPS,
  });
  const [isReducingQuality, setIsReducingQuality] = useState(false);
  const [performanceScore, setPerformanceScore] = useState(100);
  
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastFrameCount = useRef(0);
  const lastDropCount = useRef(0);
  const lastCheckTime = useRef(0);
  const qualityReductions = useRef(0);

  /**
   * Check if hardware decode is available
   */
  const checkHardwareDecode = useCallback(async (): Promise<boolean> => {
    if (!('VideoDecoder' in window)) return false;
    
    try {
      // Check for H.264 hardware decode support
      const config = {
        codec: 'avc1.42E01E', // H.264 Baseline
        hardwareAcceleration: 'prefer-hardware' as const,
        width: 1920,
        height: 1080,
      };
      
      const support = await (VideoDecoder as any).isConfigSupported(config);
      return support.supported && support.config?.hardwareAcceleration === 'prefer-hardware';
    } catch {
      return false;
    }
  }, []);

  /**
   * Get video playback quality
   */
  const getPlaybackQuality = useCallback((video: HTMLVideoElement): FrameStats | null => {
    if (!('getVideoPlaybackQuality' in video)) return null;
    
    const quality = (video as any).getVideoPlaybackQuality();
    const now = performance.now();
    const timeDelta = (now - lastCheckTime.current) / 1000;
    
    const frameDelta = quality.totalVideoFrames - lastFrameCount.current;
    const dropDelta = quality.droppedVideoFrames - lastDropCount.current;
    
    const currentFPS = timeDelta > 0 ? frameDelta / timeDelta : 0;
    const dropRate = frameDelta > 0 ? dropDelta / frameDelta : 0;
    
    lastFrameCount.current = quality.totalVideoFrames;
    lastDropCount.current = quality.droppedVideoFrames;
    lastCheckTime.current = now;
    
    return {
      totalFrames: quality.totalVideoFrames,
      droppedFrames: quality.droppedVideoFrames,
      dropRate,
      currentFPS: Math.round(currentFPS),
      targetFPS,
    };
  }, [targetFPS]);

  /**
   * Calculate performance score (0-100)
   */
  const calculatePerformanceScore = useCallback((stats: FrameStats): number => {
    // Score based on drop rate and FPS achievement
    const dropPenalty = stats.dropRate * 100; // 0-100
    const fpsPenalty = Math.max(0, (targetFPS - stats.currentFPS) / targetFPS * 50);
    
    return Math.max(0, Math.round(100 - dropPenalty - fpsPenalty));
  }, [targetFPS]);

  /**
   * Reduce quality to prevent frame drops
   */
  const reduceQuality = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls || !enabled) return;
    
    const currentLevel = hls.currentLevel;
    const minLevel = 0;
    
    if (currentLevel > minLevel) {
      hls.currentLevel = currentLevel - 1;
      qualityReductions.current++;
      setIsReducingQuality(true);
      
      console.log(`[FrameDropPrevention] Reduced quality: ${currentLevel} → ${currentLevel - 1}`);
      
      // Reset flag after stabilization
      setTimeout(() => setIsReducingQuality(false), 5000);
    }
  }, [enabled]);

  /**
   * Attach to HLS/Video
   */
  const attach = useCallback((hls: Hls, video: HTMLVideoElement) => {
    hlsRef.current = hls;
    videoRef.current = video;
    lastFrameCount.current = 0;
    lastDropCount.current = 0;
    lastCheckTime.current = performance.now();
    qualityReductions.current = 0;
  }, []);

  /**
   * Periodic frame check
   */
  useEffect(() => {
    if (!enabled || !videoRef.current) return;
    
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      
      const stats = getPlaybackQuality(video);
      if (!stats) return;
      
      setFrameStats(stats);
      
      const score = calculatePerformanceScore(stats);
      setPerformanceScore(score);
      
      // Reduce quality if drop rate exceeds threshold
      if (stats.dropRate > maxDropRate && !isReducingQuality) {
        reduceQuality();
      }
    }, checkInterval);
    
    return () => clearInterval(interval);
  }, [enabled, checkInterval, maxDropRate, getPlaybackQuality, calculatePerformanceScore, reduceQuality, isReducingQuality]);

  /**
   * Get optimized config for device
   */
  const getConfig = useCallback((): Partial<Hls['config']> => {
    // If performance is low, use conservative settings
    if (performanceScore < 70) {
      return {
        maxBufferLength: 20,
        maxMaxBufferLength: 30,
        capLevelToPlayerSize: true, // Don't load higher quality than display
        startLevel: 0, // Start at lowest quality
      };
    }
    
    return {
      capLevelToPlayerSize: true,
    };
  }, [performanceScore]);

  /**
   * Reset stats
   */
  const reset = useCallback(() => {
    lastFrameCount.current = 0;
    lastDropCount.current = 0;
    lastCheckTime.current = performance.now();
    qualityReductions.current = 0;
    setFrameStats({
      totalFrames: 0,
      droppedFrames: 0,
      dropRate: 0,
      currentFPS: 0,
      targetFPS,
    });
    setPerformanceScore(100);
    setIsReducingQuality(false);
  }, [targetFPS]);

  return {
    frameStats,
    performanceScore,
    isReducingQuality,
    qualityReductions: qualityReductions.current,
    attach,
    getConfig,
    reset,
    checkHardwareDecode,
  };
}

export default useFrameDropPrevention;
