/**
 * ============================================================================
 * useQualityPersistence - Quality Preference Persistence Hook
 * ============================================================================
 * 
 * Saves and loads user's preferred video quality from localStorage.
 * Remembers quality settings between sessions.
 */

import { useCallback, useEffect, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface QualityPreference {
  mode: 'auto' | 'manual';
  levelIndex: number; // -1 for auto
  maxBitrate?: number; // Optional cap
  lowLatency?: boolean;
  lastUpdated: number;
}

const STORAGE_KEY = 'iptv-quality-preference';
const DEFAULT_PREFERENCE: QualityPreference = {
  mode: 'auto',
  levelIndex: -1,
  lowLatency: false,
  lastUpdated: Date.now(),
};

// =============================================================================
// HOOK
// =============================================================================

export function useQualityPersistence() {
  const [preference, setPreference] = useState<QualityPreference>(DEFAULT_PREFERENCE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QualityPreference;
        setPreference(parsed);
        console.log('[QualityPersistence] Loaded preference:', parsed);
      }
    } catch (err) {
      console.debug('[QualityPersistence] Failed to load:', err);
    }
    setIsLoaded(true);
  }, []);

  // Save quality preference
  const savePreference = useCallback((newPreference: Partial<QualityPreference>) => {
    setPreference(prev => {
      const updated: QualityPreference = {
        ...prev,
        ...newPreference,
        lastUpdated: Date.now(),
      };
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log('[QualityPersistence] Saved preference:', updated);
      } catch (err) {
        console.warn('[QualityPersistence] Failed to save:', err);
      }
      
      return updated;
    });
  }, []);

  // Set auto mode
  const setAutoMode = useCallback(() => {
    savePreference({ mode: 'auto', levelIndex: -1 });
  }, [savePreference]);

  // Set manual quality level
  const setManualQuality = useCallback((levelIndex: number) => {
    savePreference({ mode: 'manual', levelIndex });
  }, [savePreference]);

  // Set max bitrate cap for auto mode
  const setMaxBitrate = useCallback((maxBitrate: number | undefined) => {
    savePreference({ maxBitrate });
  }, [savePreference]);

  // Toggle low latency mode
  const setLowLatency = useCallback((enabled: boolean) => {
    savePreference({ lowLatency: enabled });
  }, [savePreference]);

  // Clear preference (reset to default)
  const clearPreference = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPreference(DEFAULT_PREFERENCE);
  }, []);

  return {
    // State
    preference,
    isLoaded,
    isAuto: preference.mode === 'auto',
    
    // Actions
    savePreference,
    setAutoMode,
    setManualQuality,
    setMaxBitrate,
    setLowLatency,
    clearPreference,
  };
}

export default useQualityPersistence;
