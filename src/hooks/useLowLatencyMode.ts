/**
 * useLowLatencyMode - Low Latency Streaming
 * 
 * Optimizes HLS.js for minimal latency in live streams.
 * Reduces delay between broadcast and playback.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

interface LatencyStats {
  currentLatency: number;      // Current latency in seconds
  targetLatency: number;       // Target latency
  liveEdge: number;            // Distance from live edge
  playbackRate: number;        // Current playback rate
  bufferLength: number;        // Current buffer length
}

interface UseLowLatencyModeOptions {
  targetLatency?: number;        // Target latency in seconds (default: 3)
  maxLatency?: number;           // Max acceptable latency (default: 10)
  catchupRate?: number;          // Rate to catch up (default: 1.05)
  fallbackRate?: number;         // Rate when ahead (default: 0.95)
  enabled?: boolean;
}

const DEFAULT_OPTIONS: UseLowLatencyModeOptions = {
  targetLatency: 3,
  maxLatency: 10,
  catchupRate: 1.05,
  fallbackRate: 0.95,
  enabled: false,
};

export function useLowLatencyMode(options: UseLowLatencyModeOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [isEnabled, setIsEnabled] = useState(config.enabled);
  const [stats, setStats] = useState<LatencyStats>({
    currentLatency: 0,
    targetLatency: config.targetLatency!,
    liveEdge: 0,
    playbackRate: 1,
    bufferLength: 0,
  });
  
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const updateIntervalRef = useRef<number | null>(null);

  /**
   * Get low latency HLS config
   */
  const getLowLatencyConfig = useCallback((): Partial<Hls['config']> => {
    if (!isEnabled) {
      return {};
    }

    return {
      // Low latency settings
      lowLatencyMode: true,
      backBufferLength: 5,
      
      // Aggressive buffer settings
      maxBufferLength: 10,
      maxMaxBufferLength: 15,
      maxBufferSize: 30 * 1000 * 1000, // 30MB
      maxBufferHole: 0.1,
      
      // Live sync settings
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 4,
      liveDurationInfinity: true,
      
      // Fast loading
      maxLoadingDelay: 1,
      maxFragLookUpTolerance: 0.1,
      
      // Progressive loading
      progressive: true,
      
      // ABR settings for low latency
      abrEwmaDefaultEstimate: 5000000,
      abrEwmaFastLive: 3,
      abrEwmaSlowLive: 5,
      abrBandWidthFactor: 0.8,
      abrBandWidthUpFactor: 0.7,
      
      // Start at highest quality
      startLevel: -1,
      autoStartLoad: true,
    };
  }, [isEnabled]);

  /**
   * Calculate current latency
   */
  const calculateLatency = useCallback((): number => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    
    if (!video || !hls) return 0;
    
    // Get live edge from HLS
    const liveEdge = hls.liveSyncPosition || 0;
    const currentTime = video.currentTime;
    
    return Math.max(0, liveEdge - currentTime);
  }, []);

  /**
   * Update latency stats
   */
  const updateStats = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    
    if (!video || !hls) return;

    const currentLatency = calculateLatency();
    const liveEdge = hls.liveSyncPosition || 0;
    
    // Get buffer length
    let bufferLength = 0;
    if (video.buffered.length > 0) {
      bufferLength = video.buffered.end(video.buffered.length - 1) - video.currentTime;
    }

    setStats({
      currentLatency,
      targetLatency: config.targetLatency!,
      liveEdge,
      playbackRate: video.playbackRate,
      bufferLength,
    });

    // Adjust playback rate to catch up or slow down
    if (isEnabled) {
      const latencyDiff = currentLatency - config.targetLatency!;
      
      if (latencyDiff > 1) {
        // Behind - speed up
        video.playbackRate = Math.min(config.catchupRate!, 1.1);
      } else if (latencyDiff < -0.5) {
        // Ahead - slow down
        video.playbackRate = Math.max(config.fallbackRate!, 0.9);
      } else {
        // On target - normal speed
        video.playbackRate = 1;
      }
    }
  }, [isEnabled, config.targetLatency, config.catchupRate, config.fallbackRate, calculateLatency]);

  /**
   * Attach HLS instance
   */
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;
  }, []);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    
    // Start stats update interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    
    updateIntervalRef.current = window.setInterval(updateStats, 1000);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [updateStats]);

  /**
   * Enable/disable low latency mode
   */
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    
    const video = videoRef.current;
    if (video && !enabled) {
      video.playbackRate = 1;
    }
  }, []);

  /**
   * Jump to live edge
   */
  const jumpToLive = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    
    if (!video || !hls) return;
    
    const liveEdge = hls.liveSyncPosition;
    if (liveEdge && liveEdge > 0) {
      video.currentTime = liveEdge - (config.targetLatency! / 2);
    }
  }, [config.targetLatency]);

  /**
   * Check if currently at live edge
   */
  const isAtLiveEdge = useCallback((): boolean => {
    return stats.currentLatency <= config.targetLatency! * 1.5;
  }, [stats.currentLatency, config.targetLatency]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    isEnabled,
    stats,
    
    // Actions
    attachHls,
    attachVideo,
    setEnabled,
    jumpToLive,
    
    // Config
    getLowLatencyConfig,
    
    // Helpers
    isAtLiveEdge,
    calculateLatency,
  };
}

export default useLowLatencyMode;
