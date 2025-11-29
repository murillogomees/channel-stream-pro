/**
 * ============================================================================
 * useConnectionAwarePlayer - Connection-Aware Player Configuration Hook
 * ============================================================================
 * 
 * Integrates connection detection with HLS.js configuration.
 * Automatically adjusts player settings based on network quality.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import { connectionService, ConnectionInfo, ConnectionQuality } from '@/services/connectionService';
import { useQualityPersistence } from './useQualityPersistence';

// =============================================================================
// TYPES
// =============================================================================

export interface ConnectionAwareConfig {
  lowLatency?: boolean;
  maxBitrate?: number;
  startLevel?: number;
}

interface UseConnectionAwarePlayerReturn {
  connectionInfo: ConnectionInfo | null;
  quality: ConnectionQuality;
  getOptimizedHlsConfig: (userConfig?: ConnectionAwareConfig) => Partial<Hls['config']>;
  applyToHls: (hls: Hls) => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

// =============================================================================
// LOW LATENCY HLS CONFIG
// =============================================================================

const LOW_LATENCY_CONFIG: Partial<Hls['config']> = {
  lowLatencyMode: true,
  liveSyncDuration: 3,
  liveMaxLatencyDuration: 5,
  liveSyncDurationCount: 3,
  liveBackBufferLength: 10,
  maxBufferLength: 10,
  maxMaxBufferLength: 20,
  backBufferLength: 5,
  enableWorker: true,
};

// =============================================================================
// CONNECTION-BASED CONFIGS
// =============================================================================

const CONNECTION_CONFIGS: Record<ConnectionQuality, Partial<Hls['config']>> = {
  poor: {
    maxBufferLength: 10,
    maxMaxBufferLength: 20,
    startLevel: 0,
    abrEwmaDefaultEstimate: 500000, // 500 Kbps
    abrBandWidthFactor: 0.7,
    abrBandWidthUpFactor: 0.5,
    fragLoadingMaxRetry: 10,
    manifestLoadingMaxRetry: 8,
    fragLoadingRetryDelay: 500,
  },
  fair: {
    maxBufferLength: 15,
    maxMaxBufferLength: 30,
    startLevel: 0,
    abrEwmaDefaultEstimate: 1500000, // 1.5 Mbps
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.6,
    fragLoadingMaxRetry: 8,
    manifestLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 300,
  },
  good: {
    maxBufferLength: 20,
    maxMaxBufferLength: 45,
    startLevel: -1, // Auto
    abrEwmaDefaultEstimate: 3000000, // 3 Mbps
    abrBandWidthFactor: 0.9,
    abrBandWidthUpFactor: 0.7,
    fragLoadingMaxRetry: 6,
    manifestLoadingMaxRetry: 4,
    fragLoadingRetryDelay: 200,
  },
  excellent: {
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startLevel: -1, // Auto
    abrEwmaDefaultEstimate: 5000000, // 5 Mbps
    abrBandWidthFactor: 0.95,
    abrBandWidthUpFactor: 0.8,
    fragLoadingMaxRetry: 4,
    manifestLoadingMaxRetry: 3,
    fragLoadingRetryDelay: 100,
  },
};

// =============================================================================
// HOOK
// =============================================================================

export function useConnectionAwarePlayer(): UseConnectionAwarePlayerReturn {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const { preference } = useQualityPersistence();

  // Subscribe to connection changes
  useEffect(() => {
    unsubscribeRef.current = connectionService.subscribe(info => {
      setConnectionInfo(info);
      console.log('[ConnectionAware] Network quality:', info.quality, '| Downlink:', info.downlink, 'Mbps');
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  // Get optimized HLS config based on connection + user preferences
  const getOptimizedHlsConfig = useCallback((userConfig?: ConnectionAwareConfig): Partial<Hls['config']> => {
    const quality = connectionInfo?.quality || 'good';
    const baseConfig = CONNECTION_CONFIGS[quality];
    
    let config: Partial<Hls['config']> = { ...baseConfig };

    // Apply low latency mode if requested or saved in preferences
    const lowLatencyEnabled = userConfig?.lowLatency ?? preference.lowLatency;
    if (lowLatencyEnabled) {
      config = { ...config, ...LOW_LATENCY_CONFIG };
      console.log('[ConnectionAware] Low latency mode enabled');
    }

    // Apply max bitrate cap if set
    const maxBitrate = userConfig?.maxBitrate ?? preference.maxBitrate;
    if (maxBitrate) {
      config.abrEwmaDefaultEstimate = Math.min(
        config.abrEwmaDefaultEstimate || 2000000,
        maxBitrate
      );
    }

    // Apply user's saved start level preference
    if (preference.mode === 'manual' && preference.levelIndex >= 0) {
      config.startLevel = preference.levelIndex;
    } else if (userConfig?.startLevel !== undefined) {
      config.startLevel = userConfig.startLevel;
    }

    console.log('[ConnectionAware] Config for quality', quality, ':', {
      maxBuffer: config.maxBufferLength,
      startLevel: config.startLevel,
      lowLatency: lowLatencyEnabled,
    });

    return config;
  }, [connectionInfo, preference]);

  // Apply connection-aware settings to existing HLS instance
  const applyToHls = useCallback((hls: Hls) => {
    if (!connectionInfo) return;

    const quality = connectionInfo.quality;
    const maxBitrate = connectionInfo.suggestedMaxBitrate;

    // Apply max bitrate cap based on connection
    if (quality === 'poor' || quality === 'fair') {
      const levels = hls.levels;
      const maxLevel = levels.findIndex(l => l.bitrate > maxBitrate);
      if (maxLevel > 0) {
        hls.autoLevelCapping = maxLevel - 1;
        console.log('[ConnectionAware] Capped quality to level', maxLevel - 1);
      }
    } else {
      hls.autoLevelCapping = -1; // No cap
    }

    // If connection is poor and buffer is low, switch to lowest quality
    if (quality === 'poor' && hls.media) {
      const buffered = hls.media.buffered;
      if (buffered.length > 0) {
        const bufferEnd = buffered.end(buffered.length - 1);
        const currentTime = hls.media.currentTime;
        const bufferLength = bufferEnd - currentTime;

        if (bufferLength < 3) {
          hls.nextLevel = 0;
          console.log('[ConnectionAware] Low buffer + poor connection, switching to lowest quality');
        }
      }
    }
  }, [connectionInfo]);

  // Start periodic connection monitoring
  const startMonitoring = useCallback(() => {
    connectionService.startMonitoring(30000); // Every 30 seconds
  }, []);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    connectionService.stopMonitoring();
  }, []);

  return {
    connectionInfo,
    quality: connectionInfo?.quality || 'good',
    getOptimizedHlsConfig,
    applyToHls,
    startMonitoring,
    stopMonitoring,
  };
}

export default useConnectionAwarePlayer;
