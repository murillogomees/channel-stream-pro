/**
 * usePlayerStability - Unified Stability System
 * 
 * Combina todas as funcionalidades de estabilidade:
 * - Auto-Recovery Watchdog
 * - Network Change Adaptation
 * - Stall Prediction
 * - Quality Management
 */

import { useCallback, useRef, useState } from 'react';
import { usePlaybackWatchdog } from './usePlaybackWatchdog';
import { useNetworkAdaptation } from './useNetworkAdaptation';
import { useStallPrediction } from './useStallPrediction';
import { useQualityLevels } from './useQualityLevels';

interface StabilityStats {
  watchdogRecoveries: number;
  networkChanges: number;
  stallsPredicted: number;
  stallsPrevented: number;
  currentQuality: string;
  networkQuality: string;
  isStable: boolean;
}

interface UsePlayerStabilityOptions {
  enabled?: boolean;
  onRecovery?: () => void;
  onNetworkChange?: () => void;
  onStallPredicted?: () => void;
}

export function usePlayerStability(options: UsePlayerStabilityOptions = {}) {
  const {
    enabled = true,
    onRecovery,
    onNetworkChange,
    onStallPredicted,
  } = options;

  const hlsRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [networkChanges, setNetworkChanges] = useState(0);
  const [stallsPrevented, setStallsPrevented] = useState(0);

  // Sub-hooks
  const watchdog = usePlaybackWatchdog({
    enabled,
    onRecovery: () => {
      console.log('[Stability] Watchdog recovered playback');
      onRecovery?.();
    },
    onFatalError: () => {
      console.log('[Stability] Watchdog fatal error - manual intervention required');
    },
  });

  const network = useNetworkAdaptation({
    enabled,
    onQualityChange: (newQuality, oldQuality) => {
      console.log(`[Stability] Network quality changed: ${oldQuality} → ${newQuality}`);
      setNetworkChanges(prev => prev + 1);
      onNetworkChange?.();
    },
    onOffline: () => {
      console.log('[Stability] Network offline');
    },
    onOnline: () => {
      console.log('[Stability] Network back online');
    },
  });

  const stallPrediction = useStallPrediction({
    enabled,
    onHighRisk: () => {
      console.log('[Stability] High stall risk detected');
      onStallPredicted?.();
    },
    onPreventiveAction: () => {
      console.log('[Stability] Preventive action taken');
      setStallsPrevented(prev => prev + 1);
    },
  });

  // Quality levels from HLS
  const qualityLevels = useQualityLevels(hlsRef.current);

  /**
   * Attach video element to all stability systems
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    watchdog.attachVideo(video);
    stallPrediction.attachVideo(video);
  }, [watchdog, stallPrediction]);

  /**
   * Attach HLS instance to all stability systems
   */
  const attachHls = useCallback((hls: any) => {
    hlsRef.current = hls;
    watchdog.attachHls(hls);
    network.attachHls(hls);
    stallPrediction.attachHls(hls);
  }, [watchdog, network, stallPrediction]);

  /**
   * Reset all stability systems
   */
  const reset = useCallback(() => {
    watchdog.reset();
    stallPrediction.reset();
    setNetworkChanges(0);
    setStallsPrevented(0);
  }, [watchdog, stallPrediction]);

  /**
   * Get current stability stats
   */
  const getStats = useCallback((): StabilityStats => {
    return {
      watchdogRecoveries: watchdog.stats.recoveryAttempts,
      networkChanges,
      stallsPredicted: stallPrediction.state.preventiveActions,
      stallsPrevented,
      currentQuality: qualityLevels.autoLevel 
        ? 'Auto' 
        : (qualityLevels.levels.find(l => l.index === qualityLevels.currentLevel)?.label || 'Unknown'),
      networkQuality: network.quality,
      isStable: watchdog.isHealthy && stallPrediction.stallRisk !== 'high',
    };
  }, [watchdog, network, stallPrediction, stallsPrevented, networkChanges, qualityLevels]);

  /**
   * Check if playback is stable
   */
  const isStable = watchdog.isHealthy && 
    stallPrediction.stallRisk !== 'high' && 
    network.isOnline;

  return {
    // Attachment
    attachVideo,
    attachHls,
    reset,
    
    // State
    isStable,
    isOnline: network.isOnline,
    networkQuality: network.quality,
    stallRisk: stallPrediction.stallRisk,
    bufferTrend: stallPrediction.bufferTrend,
    predictedStallIn: stallPrediction.predictedStallIn,
    
    // Quality control
    qualityLevels: qualityLevels.levels,
    currentQualityLevel: qualityLevels.currentLevel,
    isAutoQuality: qualityLevels.autoLevel,
    setQualityLevel: qualityLevels.setLevel,
    
    // Stats
    getStats,
    watchdogStats: watchdog.stats,
    stallPredictionState: stallPrediction.state,
    
    // Raw sub-hooks for advanced usage
    watchdog,
    network,
    stallPrediction,
  };
}

export default usePlayerStability;
