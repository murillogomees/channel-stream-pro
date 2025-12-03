/**
 * useNetworkAdaptation - Network Change Adaptation
 * 
 * Adapta qualidade automaticamente quando conexão muda (WiFi→4G, etc)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { detectConnectionQuality, ConnectionQuality, BUFFER_PRESETS } from '@/config/playerBufferConfig';

interface NetworkState {
  effectiveType: string;
  downlink: number;
  rtt: number;
  quality: ConnectionQuality;
  isOnline: boolean;
}

interface UseNetworkAdaptationOptions {
  enabled?: boolean;
  onQualityChange?: (newQuality: ConnectionQuality, oldQuality: ConnectionQuality) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function useNetworkAdaptation(options: UseNetworkAdaptationOptions = {}) {
  const {
    enabled = true,
    onQualityChange,
    onOffline,
    onOnline,
  } = options;

  const hlsRef = useRef<any>(null);
  const previousQualityRef = useRef<ConnectionQuality>('good');

  const [networkState, setNetworkState] = useState<NetworkState>(() => ({
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    quality: detectConnectionQuality(),
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  }));

  /**
   * Update network state from connection info
   */
  const updateNetworkState = useCallback(() => {
    if (typeof navigator === 'undefined') return;

    const connection = (navigator as any).connection;
    const newQuality = detectConnectionQuality();
    const isOnline = navigator.onLine;

    setNetworkState(prev => {
      const newState: NetworkState = {
        effectiveType: connection?.effectiveType || prev.effectiveType,
        downlink: connection?.downlink || prev.downlink,
        rtt: connection?.rtt || prev.rtt,
        quality: newQuality,
        isOnline,
      };

      // Notify quality change
      if (newQuality !== previousQualityRef.current) {
        console.log(`[NetworkAdaptation] Quality changed: ${previousQualityRef.current} → ${newQuality}`);
        onQualityChange?.(newQuality, previousQualityRef.current);
        previousQualityRef.current = newQuality;
      }

      return newState;
    });
  }, [onQualityChange]);

  /**
   * Adapt HLS.js settings based on network quality
   */
  const adaptHlsSettings = useCallback((hls: any, quality: ConnectionQuality) => {
    if (!hls) return;

    const preset = BUFFER_PRESETS[quality];
    
    try {
      // Update HLS config dynamically (some settings can be changed at runtime)
      hls.config.maxBufferLength = preset.maxBufferLength;
      hls.config.maxMaxBufferLength = preset.maxMaxBufferLength;
      hls.config.maxStarvationDelay = preset.maxStarvationDelay;
      hls.config.maxLoadingDelay = preset.maxLoadingDelay;

      // Adjust ABR based on quality
      if (quality === 'poor') {
        // Force lower quality
        if (hls.levels && hls.levels.length > 1) {
          const lowestLevel = hls.levels.findIndex((l: any) => l.height <= 480);
          if (lowestLevel >= 0) {
            hls.nextLevel = lowestLevel;
            console.log(`[NetworkAdaptation] Forcing quality level ${lowestLevel} (poor connection)`);
          }
        }
      } else if (quality === 'fair') {
        // Cap at 720p
        if (hls.levels && hls.levels.length > 1) {
          const maxLevel = hls.levels.findIndex((l: any) => l.height <= 720);
          if (maxLevel >= 0) {
            hls.autoLevelCapping = maxLevel;
            console.log(`[NetworkAdaptation] Capping quality at level ${maxLevel} (fair connection)`);
          }
        }
      } else {
        // Remove quality cap
        hls.autoLevelCapping = -1;
      }

      console.log(`[NetworkAdaptation] HLS settings adapted for ${quality} connection`);
    } catch (e) {
      console.warn('[NetworkAdaptation] Failed to adapt HLS settings:', e);
    }
  }, []);

  /**
   * Attach HLS instance for dynamic adaptation
   */
  const attachHls = useCallback((hls: any) => {
    hlsRef.current = hls;
    
    // Apply initial settings based on current quality
    adaptHlsSettings(hls, networkState.quality);
  }, [adaptHlsSettings, networkState.quality]);

  /**
   * Handle online/offline events
   */
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[NetworkAdaptation] Back online');
      setNetworkState(prev => ({ ...prev, isOnline: true }));
      onOnline?.();
      updateNetworkState();
    };

    const handleOffline = () => {
      console.log('[NetworkAdaptation] Gone offline');
      setNetworkState(prev => ({ ...prev, isOnline: false }));
      onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, onOnline, onOffline, updateNetworkState]);

  /**
   * Handle connection change events
   */
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;

    const connection = (navigator as any).connection;
    if (!connection) return;

    const handleChange = () => {
      console.log('[NetworkAdaptation] Connection changed');
      updateNetworkState();
      
      // Adapt HLS if attached
      if (hlsRef.current) {
        adaptHlsSettings(hlsRef.current, detectConnectionQuality());
      }
    };

    connection.addEventListener('change', handleChange);

    return () => {
      connection.removeEventListener('change', handleChange);
    };
  }, [enabled, updateNetworkState, adaptHlsSettings]);

  // Initial detection
  useEffect(() => {
    if (enabled) {
      updateNetworkState();
    }
  }, [enabled, updateNetworkState]);

  return {
    networkState,
    attachHls,
    quality: networkState.quality,
    isOnline: networkState.isOnline,
    adaptHlsSettings,
  };
}

export default useNetworkAdaptation;
