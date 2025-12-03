/**
 * useFastStartupV2 - Ultra-fast stream startup optimization
 * 
 * Techniques:
 * - Aggressive prefetch of first segments
 * - Low initial quality for faster first frame
 * - Progressive quality upgrade
 * - Preconnect to CDN
 */

import { useCallback, useRef, useEffect } from 'react';
import Hls from 'hls.js';

interface UseFastStartupV2Options {
  /** Target time to first frame (ms) */
  targetTTFF?: number;
  /** Start with lowest quality */
  startLowQuality?: boolean;
  /** Upgrade quality after N seconds */
  upgradeDelay?: number;
  /** Preconnect to CDN domains */
  preconnectDomains?: string[];
}

interface FastStartupConfig extends Partial<Hls['config']> {
  // Extended config
}

export function useFastStartupV2(options: UseFastStartupV2Options = {}) {
  const {
    targetTTFF = 1000,
    startLowQuality = true,
    upgradeDelay = 3,
    preconnectDomains = [],
  } = options;

  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasUpgradedRef = useRef(false);

  // Preconnect to CDN domains for faster initial connection
  useEffect(() => {
    preconnectDomains.forEach(domain => {
      const existing = document.querySelector(`link[href="${domain}"][rel="preconnect"]`);
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  }, [preconnectDomains]);

  /**
   * Get optimized HLS config for fast startup
   */
  const getConfig = useCallback((): FastStartupConfig => {
    return {
      // Start with small buffer for fast first frame
      maxBufferLength: 10,
      maxMaxBufferLength: 30,
      maxBufferSize: 10 * 1000 * 1000, // 10MB initial
      
      // Aggressive loading
      startFragPrefetch: true,
      testBandwidth: false, // Skip initial bandwidth test
      
      // Fast manifest loading
      manifestLoadingTimeOut: 8000,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 500,
      
      // Fast fragment loading
      fragLoadingTimeOut: 10000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,
      
      // Start at lowest level for fast first frame
      startLevel: startLowQuality ? 0 : -1,
      
      // Disable progressive loading for faster start
      progressive: false,
      
      // Low latency optimizations
      lowLatencyMode: false, // Disable for VOD, can enable for live
      backBufferLength: 30,
      
      // ABR tuning for fast startup
      abrEwmaFastLive: 2.0,
      abrEwmaSlowLive: 6.0,
      abrEwmaFastVoD: 2.0,
      abrEwmaSlowVoD: 6.0,
      abrBandWidthFactor: 0.8,
      abrBandWidthUpFactor: 0.5, // Aggressive upgrade
    };
  }, [startLowQuality]);

  /**
   * Attach HLS instance for quality upgrade management
   */
  const attach = useCallback((hls: Hls, video: HTMLVideoElement) => {
    hlsRef.current = hls;
    videoRef.current = video;
    startTimeRef.current = performance.now();
    hasUpgradedRef.current = false;

    // Auto-upgrade quality after delay
    if (startLowQuality && upgradeDelay > 0) {
      const upgradeTimer = setTimeout(() => {
        if (hls && !hasUpgradedRef.current) {
          // Switch to auto ABR
          hls.currentLevel = -1;
          hasUpgradedRef.current = true;
          console.log('[FastStartup] Upgraded to auto quality');
        }
      }, upgradeDelay * 1000);

      // Also upgrade on first play if buffer is healthy
      const handlePlaying = () => {
        const buffered = video.buffered;
        if (buffered.length > 0) {
          const bufferEnd = buffered.end(buffered.length - 1);
          const bufferAhead = bufferEnd - video.currentTime;
          
          // If we have good buffer, upgrade immediately
          if (bufferAhead > 5 && !hasUpgradedRef.current) {
            clearTimeout(upgradeTimer);
            hls.currentLevel = -1;
            hasUpgradedRef.current = true;
            console.log('[FastStartup] Early upgrade - buffer healthy');
          }
        }
      };

      video.addEventListener('playing', handlePlaying, { once: true });

      return () => {
        clearTimeout(upgradeTimer);
        video.removeEventListener('playing', handlePlaying);
      };
    }
  }, [startLowQuality, upgradeDelay]);

  /**
   * Get time to first frame
   */
  const getTTFF = useCallback(() => {
    if (startTimeRef.current === 0) return 0;
    return performance.now() - startTimeRef.current;
  }, []);

  /**
   * Reset for new stream
   */
  const reset = useCallback(() => {
    startTimeRef.current = 0;
    hasUpgradedRef.current = false;
  }, []);

  return {
    getConfig,
    attach,
    getTTFF,
    reset,
    targetTTFF,
  };
}

export default useFastStartupV2;
