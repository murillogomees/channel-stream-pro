/**
 * useEnhancedSmartBuffer - Advanced adaptive buffering with network prediction
 * Dynamically adjusts buffer sizes based on network conditions, device, and content type
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';

type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
type ContentType = 'live' | 'vod' | 'unknown';

interface BufferMetrics {
  currentBuffer: number;
  targetBuffer: number;
  bufferHealth: number;
  stallCount: number;
  recoveryCount: number;
  avgBitrate: number;
  networkQuality: NetworkQuality;
}

interface EnhancedBufferConfig {
  minBuffer: number;
  maxBuffer: number;
  targetBuffer: number;
  backBuffer: number;
  startLevel: number;
  maxLoadingDelay: number;
}

const QUALITY_CONFIGS: Record<NetworkQuality, EnhancedBufferConfig> = {
  excellent: {
    minBuffer: 10,
    maxBuffer: 60,
    targetBuffer: 30,
    backBuffer: 30,
    startLevel: -1, // Auto
    maxLoadingDelay: 4,
  },
  good: {
    minBuffer: 15,
    maxBuffer: 45,
    targetBuffer: 25,
    backBuffer: 20,
    startLevel: -1,
    maxLoadingDelay: 6,
  },
  fair: {
    minBuffer: 20,
    maxBuffer: 40,
    targetBuffer: 30,
    backBuffer: 15,
    startLevel: 0, // Start low
    maxLoadingDelay: 8,
  },
  poor: {
    minBuffer: 30,
    maxBuffer: 60,
    targetBuffer: 45,
    backBuffer: 10,
    startLevel: 0,
    maxLoadingDelay: 12,
  },
  offline: {
    minBuffer: 60,
    maxBuffer: 120,
    targetBuffer: 90,
    backBuffer: 5,
    startLevel: 0,
    maxLoadingDelay: 20,
  },
};

const LIVE_ADJUSTMENTS: Partial<EnhancedBufferConfig> = {
  minBuffer: 5,
  maxBuffer: 20,
  targetBuffer: 10,
  backBuffer: 5,
};

interface UseEnhancedSmartBufferOptions {
  contentType?: ContentType;
  onQualityChange?: (quality: NetworkQuality) => void;
  onStall?: () => void;
}

export function useEnhancedSmartBuffer(options: UseEnhancedSmartBufferOptions = {}) {
  const { contentType = 'unknown', onQualityChange, onStall } = options;

  const [metrics, setMetrics] = useState<BufferMetrics>({
    currentBuffer: 0,
    targetBuffer: 30,
    bufferHealth: 100,
    stallCount: 0,
    recoveryCount: 0,
    avgBitrate: 0,
    networkQuality: 'good',
  });

  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bandwidthSamples = useRef<number[]>([]);
  const stallHistory = useRef<number[]>([]);
  const measureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect network quality from bandwidth samples
  const detectQuality = useCallback((bandwidth: number): NetworkQuality => {
    if (bandwidth >= 10000000) return 'excellent'; // 10+ Mbps
    if (bandwidth >= 5000000) return 'good';       // 5+ Mbps
    if (bandwidth >= 2000000) return 'fair';       // 2+ Mbps
    if (bandwidth >= 500000) return 'poor';        // 0.5+ Mbps
    return 'offline';
  }, []);

  // Get current config based on quality and content type
  const currentConfig = useMemo((): EnhancedBufferConfig => {
    const baseConfig = QUALITY_CONFIGS[metrics.networkQuality];
    
    if (contentType === 'live') {
      return {
        ...baseConfig,
        ...LIVE_ADJUSTMENTS,
      };
    }
    
    return baseConfig;
  }, [metrics.networkQuality, contentType]);

  // Apply config to HLS instance
  const applyConfig = useCallback((hls: Hls, config: EnhancedBufferConfig) => {
    if (!hls) return;

    hls.config.maxBufferLength = config.maxBuffer;
    hls.config.maxMaxBufferLength = config.maxBuffer * 1.5;
    hls.config.maxBufferSize = config.maxBuffer * 1000 * 1000;
    hls.config.maxBufferHole = 0.5;
    hls.config.startLevel = config.startLevel;
    
    console.log('[EnhancedBuffer] Applied config:', {
      quality: metrics.networkQuality,
      maxBuffer: config.maxBuffer,
      targetBuffer: config.targetBuffer,
    });
  }, [metrics.networkQuality]);

  // Attach to HLS instance
  const attachHls = useCallback((hls: Hls) => {
    hlsRef.current = hls;
    applyConfig(hls, currentConfig);

    // Monitor bandwidth from fragment loads
    hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
      if (data.frag.stats.total && data.frag.stats.loading.end) {
        const loadTime = data.frag.stats.loading.end - data.frag.stats.loading.start;
        const bandwidth = (data.frag.stats.total * 8) / (loadTime / 1000);
        
        bandwidthSamples.current.push(bandwidth);
        if (bandwidthSamples.current.length > 10) {
          bandwidthSamples.current.shift();
        }

        // Calculate average and update quality
        const avgBandwidth = bandwidthSamples.current.reduce((a, b) => a + b, 0) / bandwidthSamples.current.length;
        const newQuality = detectQuality(avgBandwidth);

        if (newQuality !== metrics.networkQuality) {
          setMetrics(prev => ({ ...prev, networkQuality: newQuality, avgBitrate: avgBandwidth }));
          onQualityChange?.(newQuality);
          applyConfig(hls, QUALITY_CONFIGS[newQuality]);
        }
      }
    });

    // Monitor for errors/stalls
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.details === 'bufferStalledError' || data.details === 'bufferNudgeOnStall') {
        stallHistory.current.push(Date.now());
        // Keep only stalls from last 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        stallHistory.current = stallHistory.current.filter(t => t > fiveMinutesAgo);
        
        setMetrics(prev => ({ 
          ...prev, 
          stallCount: prev.stallCount + 1 
        }));
        onStall?.();

        // If too many stalls, degrade quality
        if (stallHistory.current.length >= 3) {
          const currentQualityIndex = ['excellent', 'good', 'fair', 'poor', 'offline'].indexOf(metrics.networkQuality);
          if (currentQualityIndex < 4) {
            const degradedQuality = ['excellent', 'good', 'fair', 'poor', 'offline'][currentQualityIndex + 1] as NetworkQuality;
            setMetrics(prev => ({ ...prev, networkQuality: degradedQuality }));
            applyConfig(hls, QUALITY_CONFIGS[degradedQuality]);
          }
        }
      }
    });
  }, [currentConfig, applyConfig, detectQuality, metrics.networkQuality, onQualityChange, onStall]);

  // Attach to video element
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;

    // Start buffer measurement
    if (measureIntervalRef.current) {
      clearInterval(measureIntervalRef.current);
    }

    measureIntervalRef.current = setInterval(() => {
      if (!video || video.paused) return;

      const buffered = video.buffered;
      if (buffered.length > 0) {
        const currentTime = video.currentTime;
        let bufferEnd = 0;
        
        for (let i = 0; i < buffered.length; i++) {
          if (buffered.start(i) <= currentTime && buffered.end(i) >= currentTime) {
            bufferEnd = buffered.end(i);
            break;
          }
        }

        const currentBuffer = bufferEnd - currentTime;
        const bufferHealth = Math.min(100, (currentBuffer / currentConfig.targetBuffer) * 100);

        setMetrics(prev => ({
          ...prev,
          currentBuffer,
          targetBuffer: currentConfig.targetBuffer,
          bufferHealth,
        }));
      }
    }, 1000);

    // Listen for stalls
    video.addEventListener('waiting', () => {
      stallHistory.current.push(Date.now());
      setMetrics(prev => ({ ...prev, stallCount: prev.stallCount + 1 }));
      onStall?.();
    });
  }, [currentConfig.targetBuffer, onStall]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (measureIntervalRef.current) {
        clearInterval(measureIntervalRef.current);
      }
    };
  }, []);

  // Get HLS config for initialization
  const getHlsConfig = useCallback((): Partial<Hls['config']> => {
    return {
      maxBufferLength: currentConfig.maxBuffer,
      maxMaxBufferLength: currentConfig.maxBuffer * 1.5,
      maxBufferSize: currentConfig.maxBuffer * 1000 * 1000,
      maxBufferHole: 0.5,
      startLevel: currentConfig.startLevel,
      enableWorker: true,
      lowLatencyMode: contentType === 'live',
      backBufferLength: currentConfig.backBuffer,
    };
  }, [currentConfig, contentType]);

  // Force quality level
  const forceQuality = useCallback((quality: NetworkQuality) => {
    setMetrics(prev => ({ ...prev, networkQuality: quality }));
    if (hlsRef.current) {
      applyConfig(hlsRef.current, QUALITY_CONFIGS[quality]);
    }
  }, [applyConfig]);

  // Reset metrics
  const reset = useCallback(() => {
    bandwidthSamples.current = [];
    stallHistory.current = [];
    setMetrics({
      currentBuffer: 0,
      targetBuffer: 30,
      bufferHealth: 100,
      stallCount: 0,
      recoveryCount: 0,
      avgBitrate: 0,
      networkQuality: 'good',
    });
  }, []);

  return {
    metrics,
    currentConfig,
    attachHls,
    attachVideo,
    getHlsConfig,
    forceQuality,
    reset,
  };
}

export type { BufferMetrics, EnhancedBufferConfig, NetworkQuality };
export default useEnhancedSmartBuffer;
