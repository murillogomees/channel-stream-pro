/**
 * usePlayerStats - Hook for collecting player statistics
 * 
 * Provides real-time stats: bitrate, buffer, fps, latency
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

export interface PlayerStats {
  // Video
  resolution: string;
  fps: number;
  codec: string;
  
  // Network
  bandwidth: number;
  estimatedBandwidth: number;
  downloadSpeed: number;
  
  // Buffer
  bufferLength: number;
  bufferSize: number;
  bufferStalls: number;
  
  // Latency (live)
  latency: number;
  liveEdge: number;
  
  // Quality
  currentLevel: number;
  maxLevel: number;
  levelBitrate: number;
  
  // Fragments
  fragmentsLoaded: number;
  fragmentDuration: number;
  
  // Playback
  currentTime: number;
  duration: number;
  playbackRate: number;
  droppedFrames: number;
}

interface UsePlayerStatsOptions {
  /** Update interval in ms */
  updateInterval?: number;
  /** Whether stats collection is enabled */
  enabled?: boolean;
}

export function usePlayerStats(options: UsePlayerStatsOptions = {}) {
  const { updateInterval = 500, enabled = true } = options;
  
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stallCountRef = useRef(0);
  const fragmentCountRef = useRef(0);

  const updateStats = useCallback(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    
    if (!video) return;

    const newStats: PlayerStats = {
      // Video
      resolution: `${video.videoWidth}x${video.videoHeight}`,
      fps: 0,
      codec: '',
      
      // Network
      bandwidth: 0,
      estimatedBandwidth: 0,
      downloadSpeed: 0,
      
      // Buffer
      bufferLength: 0,
      bufferSize: 0,
      bufferStalls: stallCountRef.current,
      
      // Latency
      latency: 0,
      liveEdge: 0,
      
      // Quality
      currentLevel: -1,
      maxLevel: 0,
      levelBitrate: 0,
      
      // Fragments
      fragmentsLoaded: fragmentCountRef.current,
      fragmentDuration: 0,
      
      // Playback
      currentTime: video.currentTime,
      duration: video.duration || 0,
      playbackRate: video.playbackRate,
      droppedFrames: 0,
    };

    // Buffer calculation
    if (video.buffered.length > 0) {
      newStats.bufferLength = video.buffered.end(video.buffered.length - 1) - video.currentTime;
    }

    // Dropped frames (if available)
    if ('getVideoPlaybackQuality' in video) {
      const quality = (video as any).getVideoPlaybackQuality();
      newStats.droppedFrames = quality.droppedVideoFrames || 0;
      if (quality.totalVideoFrames > 0 && video.currentTime > 0) {
        newStats.fps = Math.round(quality.totalVideoFrames / video.currentTime);
      }
    }

    // HLS-specific stats
    if (hls) {
      newStats.bandwidth = hls.bandwidthEstimate || 0;
      newStats.estimatedBandwidth = hls.bandwidthEstimate || 0;
      newStats.currentLevel = hls.currentLevel;
      newStats.maxLevel = hls.levels?.length - 1 || 0;
      
      const currentLevelData = hls.levels?.[hls.currentLevel];
      if (currentLevelData) {
        newStats.levelBitrate = currentLevelData.bitrate || 0;
        newStats.codec = currentLevelData.videoCodec || currentLevelData.audioCodec || '';
      }
      
      if (hls.liveSyncPosition) {
        newStats.liveEdge = hls.liveSyncPosition;
        newStats.latency = hls.liveSyncPosition - video.currentTime;
      }
    }

    setStats(newStats);
  }, []);

  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;
    
    hls.on(Hls.Events.FRAG_LOADED, () => {
      fragmentCountRef.current++;
    });
    
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.details === 'bufferStalledError') {
        stallCountRef.current++;
      }
    });
  }, []);

  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    
    video.addEventListener('stalled', () => {
      stallCountRef.current++;
    });
  }, []);

  const startCollecting = useCallback(() => {
    if (!enabled || isCollecting) return;
    
    setIsCollecting(true);
    updateStats();
    intervalRef.current = window.setInterval(updateStats, updateInterval);
  }, [enabled, isCollecting, updateStats, updateInterval]);

  const stopCollecting = useCallback(() => {
    setIsCollecting(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stallCountRef.current = 0;
    fragmentCountRef.current = 0;
    setStats(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    stats,
    isCollecting,
    attachHls,
    attachVideo,
    startCollecting,
    stopCollecting,
    reset,
  };
}

export default usePlayerStats;
