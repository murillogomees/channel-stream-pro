/**
 * ============================================================================
 * useABR - Adaptive Bitrate Hook
 * ============================================================================
 * 
 * Hook para gerenciar qualidade adaptativa de vídeo
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  abrService, 
  QualityLevel, 
  ABRStats, 
  ABRMode,
  getQualityLabel,
  formatBitrate,
} from '@/services/abrService';

interface UseABROptions {
  onQualityChange?: (level: QualityLevel) => void;
  defaultMode?: ABRMode;
}

export function useABR(options: UseABROptions = {}) {
  const { onQualityChange, defaultMode = 'auto' } = options;
  
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<QualityLevel | null>(null);
  const [mode, setMode] = useState<ABRMode>(defaultMode);
  const [stats, setStats] = useState<ABRStats | null>(null);
  const [isAttached, setIsAttached] = useState(false);
  
  const hlsRef = useRef<Hls | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Attach to HLS instance
   */
  const attach = useCallback((hls: Hls) => {
    hlsRef.current = hls;
    
    // Wait for manifest parsed to get levels
    const handleManifestParsed = () => {
      const availableLevels = abrService.getAvailableLevels();
      setLevels(availableLevels);
      setIsAttached(true);
      
      console.log('[useABR] Attached, levels:', availableLevels.length - 1); // -1 for auto
    };

    hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);

    abrService.attach(hls, (level) => {
      setCurrentLevel(level);
      onQualityChange?.(level);
    });

    // Start stats polling
    statsIntervalRef.current = setInterval(() => {
      setStats(abrService.getStats());
    }, 2000);

    return () => {
      hls.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      abrService.detach();
      setIsAttached(false);
    };
  }, [onQualityChange]);

  /**
   * Set quality level
   */
  const setQuality = useCallback((levelIndex: number) => {
    abrService.setLevel(levelIndex);
    setMode(levelIndex === -1 ? 'auto' : 'manual');
    
    // Update current level
    const newLevel = abrService.getCurrentLevel();
    if (newLevel) {
      setCurrentLevel(newLevel);
    }
  }, []);

  /**
   * Switch to auto mode
   */
  const setAutoMode = useCallback(() => {
    setQuality(-1);
  }, [setQuality]);

  /**
   * Set max bitrate cap for auto mode
   */
  const setMaxBitrate = useCallback((maxBitrate: number) => {
    abrService.setMaxAutoBitrate(maxBitrate);
  }, []);

  /**
   * Clear max bitrate cap
   */
  const clearMaxBitrate = useCallback(() => {
    abrService.clearMaxAutoBitrate();
  }, []);

  /**
   * Get recommended level based on bandwidth
   */
  const getRecommended = useCallback((): QualityLevel | null => {
    return abrService.getRecommendedLevel();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      abrService.detach();
    };
  }, []);

  return {
    // State
    levels,
    currentLevel,
    mode,
    stats,
    isAttached,
    
    // Actions
    attach,
    setQuality,
    setAutoMode,
    setMaxBitrate,
    clearMaxBitrate,
    getRecommended,
    
    // Helpers
    getQualityLabel,
    formatBitrate,
  };
}

export default useABR;
