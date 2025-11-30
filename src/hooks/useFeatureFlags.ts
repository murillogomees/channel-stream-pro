/**
 * useFeatureFlags - React hook for feature flags
 */

import { useState, useCallback, useEffect } from 'react';
import { featureFlagsService, FeatureFlag } from '@/services/featureFlagsService';
import { useAuth } from '@/contexts/AuthContext';

export function useFeatureFlags() {
  const { user } = useAuth();
  const [, forceUpdate] = useState({});

  // Set user ID for percentage-based targeting
  useEffect(() => {
    if (user?.id) {
      featureFlagsService.setUserId(user.id);
      forceUpdate({}); // Refresh to recalculate flags
    }
  }, [user?.id]);

  /**
   * Check if a feature flag is enabled
   */
  const isEnabled = useCallback((flag: FeatureFlag): boolean => {
    return featureFlagsService.isEnabled(flag);
  }, []);

  /**
   * Override a flag (for testing)
   */
  const override = useCallback((flag: FeatureFlag, enabled: boolean) => {
    featureFlagsService.override(flag, enabled);
    forceUpdate({});
  }, []);

  /**
   * Clear override
   */
  const clearOverride = useCallback((flag: FeatureFlag) => {
    featureFlagsService.clearOverride(flag);
    forceUpdate({});
  }, []);

  /**
   * Get all flags status
   */
  const getAllFlags = useCallback(() => {
    return featureFlagsService.getAllFlags();
  }, []);

  return {
    isEnabled,
    override,
    clearOverride,
    getAllFlags,
    deviceType: featureFlagsService.getDeviceType(),
    isTV: featureFlagsService.isTV(),
    isMobile: featureFlagsService.isMobile(),
  };
}

/**
 * Shorthand hooks for common flags
 */
export function useEnhancedABR(): boolean {
  return featureFlagsService.isEnabled('enhanced_abr');
}

export function useSegmentPrefetch(): boolean {
  return featureFlagsService.isEnabled('segment_prefetch');
}

export function useResumeSupport(): boolean {
  return featureFlagsService.isEnabled('resume_support');
}

export function usePlayerAnalytics(): boolean {
  return featureFlagsService.isEnabled('player_analytics');
}

export function useWebVitalsTracking(): boolean {
  return featureFlagsService.isEnabled('web_vitals_tracking');
}

export function useTVOptimizations(): boolean {
  return featureFlagsService.isEnabled('tv_optimizations');
}

export default useFeatureFlags;
