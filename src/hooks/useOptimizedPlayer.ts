/**
 * useOptimizedPlayer - CONSOLIDATED
 * 
 * Unified hook leveraging usePlayerPerformanceV2 for all player optimizations.
 * Maintains backward compatibility while using V2 internally.
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { usePlayerPerformanceV2 } from './usePlayerPerformanceV2';
import { useFastStartupV2 } from './useFastStartupV2';
import { useAdaptiveBuffer } from './useAdaptiveBuffer';

interface Channel {
  id: string;
  name?: string;
  stream_url: string;
}

interface UseOptimizedPlayerOptions {
  channels?: Channel[];
  currentChannelId?: string;
  isLive?: boolean;
  enablePreload?: boolean;
}

interface PlaybackStats {
  startupTime: number;
  timeToFirstFrame: number;
  bufferHealth: number;
  qualityLevel: number;
  stallCount: number;
  preloadedChannels: number;
  cacheHits: number;
}

export function useOptimizedPlayer(options: UseOptimizedPlayerOptions = {}) {
  const {
    channels = [],
    currentChannelId,
    isLive = true,
    enablePreload = true,
  } = options;

  // V2 hooks (canonical implementations)
  const performance = usePlayerPerformanceV2({
    enabled: true,
    isLive,
    cdnDomains: [],
  });

  const fastStartup = useFastStartupV2({
    startLowQuality: true,
    upgradeDelay: isLive ? 2 : 3,
  });

  const adaptiveBuffer = useAdaptiveBuffer({ isLive });

  // Refs
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);

  // Stats
  const [stats, setStats] = useState<PlaybackStats>({
    startupTime: 0,
    timeToFirstFrame: 0,
    bufferHealth: 100,
    qualityLevel: -1,
    stallCount: 0,
    preloadedChannels: 0,
    cacheHits: 0,
  });

  // Preload adjacent channels when channel changes
  useEffect(() => {
    if (!enablePreload || !currentChannelId || channels.length === 0) return;

    const currentIndex = channels.findIndex(c => c.id === currentChannelId);
    if (currentIndex === -1) return;

    // Preload next 2 channels with link prefetch
    const toPreload = [];
    if (currentIndex < channels.length - 1) {
      toPreload.push(channels[currentIndex + 1]);
    }
    if (currentIndex > 0) {
      toPreload.push(channels[currentIndex - 1]);
    }

    toPreload.forEach(ch => {
      if (ch.stream_url) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = ch.stream_url;
        link.as = 'fetch';
        document.head.appendChild(link);
        setTimeout(() => link.remove(), 30000);
      }
    });

    setStats(prev => ({ ...prev, preloadedChannels: toPreload.length }));
  }, [currentChannelId, channels, enablePreload]);

  // Optimized HLS config combining all sources
  const getOptimizedHlsConfig = useCallback((): Partial<Hls['config']> => {
    const perfConfig = performance.getOptimizedConfig();
    const startupConfig = fastStartup.getConfig();
    const bufferConfig = adaptiveBuffer.getHlsConfig;

    return {
      ...bufferConfig,
      ...perfConfig,
      ...startupConfig,

      // Performance overrides
      enableWorker: true,
      startFragPrefetch: true,
      progressive: true,

      // Minimal delay for startup
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,

      // Robust retry
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
  }, [performance, fastStartup, adaptiveBuffer.getHlsConfig, isLive]);

  // Initialize player
  const initializePlayer = useCallback(async (
    video: HTMLVideoElement,
    url: string
  ): Promise<Hls | null> => {
    startTimeRef.current = window.performance.now();
    videoRef.current = video;

    // Cleanup previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.load();
        return null;
      }
      throw new Error('HLS not supported');
    }

    const config = getOptimizedHlsConfig();
    const hls = new Hls(config);
    hlsRef.current = hls;

    // Attach to V2 hooks
    performance.attach(hls, video);
    fastStartup.attach(hls, video);
    adaptiveBuffer.attachHls(hls);
    adaptiveBuffer.attachVideo(video);

    // Event listeners for stats
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const startupTime = window.performance.now() - startTimeRef.current;
      setStats(prev => ({ ...prev, startupTime }));
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      if (stats.timeToFirstFrame === 0) {
        const ttff = window.performance.now() - startTimeRef.current;
        setStats(prev => ({ ...prev, timeToFirstFrame: ttff }));
      }
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      setStats(prev => ({ ...prev, qualityLevel: data.level }));
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
        setStats(prev => ({ ...prev, stallCount: prev.stallCount + 1 }));
      }
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    return hls;
  }, [performance, fastStartup, adaptiveBuffer, getOptimizedHlsConfig, stats.timeToFirstFrame]);

  // Preload URL manually
  const preloadUrl = useCallback(async (url: string) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
    setTimeout(() => link.remove(), 60000);
    return { success: true };
  }, []);

  // Check if URL is preloaded (simplified)
  const isPreloaded = useCallback((_url: string): boolean => false, []);

  // Destroy player
  const destroy = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    performance.cleanup();
    fastStartup.reset();
    adaptiveBuffer.detach();
  }, [performance, fastStartup, adaptiveBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { destroy(); };
  }, [destroy]);

  // Update buffer stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = performance.getMetrics();
      setStats(prev => ({
        ...prev,
        bufferHealth: metrics.bufferHealth,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [performance]);

  // Device capabilities from V2 (memoized)
  const deviceCapabilities = useMemo(() => ({
    isLowEnd: false,
    maxResolution: '1080p' as const,
    supportsHardwareDecoding: true,
    // @ts-ignore - deviceMemory is not in all browsers
    memory: (navigator as any).deviceMemory || 4,
    cores: navigator.hardwareConcurrency || 4,
  }), []);

  const codecSupport = useMemo(() => {
    const video = document.createElement('video');
    return {
      h264Baseline: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
      h264Main: video.canPlayType('video/mp4; codecs="avc1.4D401E"') !== '',
      h264High: video.canPlayType('video/mp4; codecs="avc1.64001E"') !== '',
      h265: video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== '',
      vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
      av1: video.canPlayType('video/mp4; codecs="av01.0.01M.08"') !== '',
    };
  }, []);

  return {
    // Initialization
    initializePlayer,
    destroy,

    // Preloading
    preloadUrl,
    isPreloaded,
    preloadBatch: async (urls: Array<{ url: string; priority: string }>) => {
      urls.slice(0, 3).forEach(u => preloadUrl(u.url));
    },

    // Config
    getOptimizedHlsConfig,

    // Stats
    stats,
    bufferStats: adaptiveBuffer.stats,
    deviceCapabilities,
    codecSupport,

    // Refs
    hlsRef,
    videoRef,

    // Status
    isWorkerReady: true,
    isAnalyzing: false,
    healthStatus: performance.healthStatus,
  };
}

export default useOptimizedPlayer;
