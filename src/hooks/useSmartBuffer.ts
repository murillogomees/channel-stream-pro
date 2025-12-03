/**
 * useSmartBuffer - Intelligent buffer management based on network conditions
 * 
 * Features:
 * - Dynamic buffer sizing based on bandwidth
 * - Network quality detection
 * - Predictive buffering
 * - Stall prevention
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

interface BufferConfig {
  minBuffer: number;
  maxBuffer: number;
  targetBuffer: number;
  backBuffer: number;
}

interface UseSmartBufferOptions {
  /** Enable adaptive buffering */
  enabled?: boolean;
  /** Minimum buffer in seconds */
  minBuffer?: number;
  /** Maximum buffer in seconds */
  maxBuffer?: number;
  /** Check interval in ms */
  checkInterval?: number;
}

const NETWORK_CONFIGS: Record<NetworkQuality, BufferConfig> = {
  excellent: { minBuffer: 15, maxBuffer: 60, targetBuffer: 30, backBuffer: 60 },
  good: { minBuffer: 20, maxBuffer: 90, targetBuffer: 45, backBuffer: 45 },
  fair: { minBuffer: 30, maxBuffer: 120, targetBuffer: 60, backBuffer: 30 },
  poor: { minBuffer: 45, maxBuffer: 180, targetBuffer: 90, backBuffer: 15 },
  offline: { minBuffer: 60, maxBuffer: 300, targetBuffer: 120, backBuffer: 10 },
};

export function useSmartBuffer(options: UseSmartBufferOptions = {}) {
  const {
    enabled = true,
    minBuffer = 15,
    maxBuffer = 120,
    checkInterval = 2000,
  } = options;

  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('good');
  const [currentConfig, setCurrentConfig] = useState<BufferConfig>(NETWORK_CONFIGS.good);
  const [bufferHealth, setBufferHealth] = useState(100);
  
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bandwidthSamples = useRef<number[]>([]);
  const stallCount = useRef(0);
  const lastStallTime = useRef(0);

  /**
   * Detect network quality based on bandwidth samples
   */
  const detectNetworkQuality = useCallback((bandwidth: number): NetworkQuality => {
    // Bandwidth in bits per second
    if (bandwidth >= 10000000) return 'excellent'; // 10+ Mbps
    if (bandwidth >= 5000000) return 'good';       // 5+ Mbps
    if (bandwidth >= 2000000) return 'fair';       // 2+ Mbps
    if (bandwidth >= 500000) return 'poor';        // 500+ Kbps
    return 'offline';
  }, []);

  /**
   * Calculate buffer health (0-100)
   */
  const calculateBufferHealth = useCallback((video: HTMLVideoElement): number => {
    if (!video || video.buffered.length === 0) return 0;
    
    const bufferEnd = video.buffered.end(video.buffered.length - 1);
    const bufferAhead = bufferEnd - video.currentTime;
    const targetBuffer = currentConfig.targetBuffer;
    
    // Health is percentage of target buffer achieved
    const health = Math.min(100, (bufferAhead / targetBuffer) * 100);
    return Math.round(health);
  }, [currentConfig.targetBuffer]);

  /**
   * Attach to HLS instance
   */
  const attach = useCallback((hls: Hls, video: HTMLVideoElement) => {
    if (!enabled) return;
    
    hlsRef.current = hls;
    videoRef.current = video;
    bandwidthSamples.current = [];
    stallCount.current = 0;

    // Monitor bandwidth changes
    hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
      const bandwidth = hls.bandwidthEstimate;
      if (bandwidth > 0) {
        bandwidthSamples.current.push(bandwidth);
        
        // Keep last 10 samples
        if (bandwidthSamples.current.length > 10) {
          bandwidthSamples.current.shift();
        }
        
        // Calculate average bandwidth
        const avgBandwidth = bandwidthSamples.current.reduce((a, b) => a + b, 0) 
          / bandwidthSamples.current.length;
        
        const quality = detectNetworkQuality(avgBandwidth);
        
        if (quality !== networkQuality) {
          setNetworkQuality(quality);
          setCurrentConfig(NETWORK_CONFIGS[quality]);
          
          // Apply new buffer config to HLS
          hls.config.maxBufferLength = NETWORK_CONFIGS[quality].maxBuffer;
          hls.config.maxMaxBufferLength = NETWORK_CONFIGS[quality].maxBuffer * 1.5;
          hls.config.backBufferLength = NETWORK_CONFIGS[quality].backBuffer;
          
          console.log(`[SmartBuffer] Network quality: ${quality}, buffer: ${NETWORK_CONFIGS[quality].targetBuffer}s`);
        }
      }
    });

    // Monitor stalls
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.details === 'bufferStalledError') {
        stallCount.current++;
        lastStallTime.current = Date.now();
        
        // Increase buffer on frequent stalls
        if (stallCount.current >= 2 && Date.now() - lastStallTime.current < 30000) {
          const downgrade = (): NetworkQuality => {
            switch (networkQuality) {
              case 'excellent': return 'good';
              case 'good': return 'fair';
              case 'fair': return 'poor';
              default: return 'poor';
            }
          };
          
          const newQuality = downgrade();
          setNetworkQuality(newQuality);
          setCurrentConfig(NETWORK_CONFIGS[newQuality]);
          console.log(`[SmartBuffer] Stall detected, downgrading to: ${newQuality}`);
        }
      }
    });

    // Monitor buffer health
    video.addEventListener('waiting', () => {
      stallCount.current++;
    });

  }, [enabled, networkQuality, detectNetworkQuality]);

  /**
   * Periodic buffer health check
   */
  useEffect(() => {
    if (!enabled || !videoRef.current) return;
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        const health = calculateBufferHealth(videoRef.current);
        setBufferHealth(health);
      }
    }, checkInterval);
    
    return () => clearInterval(interval);
  }, [enabled, checkInterval, calculateBufferHealth]);

  /**
   * Get current buffer config
   */
  const getConfig = useCallback((): Partial<Hls['config']> => {
    return {
      maxBufferLength: currentConfig.maxBuffer,
      maxMaxBufferLength: currentConfig.maxBuffer * 1.5,
      backBufferLength: currentConfig.backBuffer,
      maxBufferHole: 0.5,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
    };
  }, [currentConfig]);

  /**
   * Reset stats
   */
  const reset = useCallback(() => {
    bandwidthSamples.current = [];
    stallCount.current = 0;
    lastStallTime.current = 0;
    setNetworkQuality('good');
    setCurrentConfig(NETWORK_CONFIGS.good);
    setBufferHealth(100);
  }, []);

  return {
    networkQuality,
    bufferHealth,
    currentConfig,
    stallCount: stallCount.current,
    attach,
    getConfig,
    reset,
  };
}

export default useSmartBuffer;
