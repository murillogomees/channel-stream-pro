/**
 * ============================================================================
 * useSmartCache - Unified Smart Cache Hook
 * ============================================================================
 * 
 * Combines behavior tracking, predictive caching, and cache warming
 * for Netflix-style intelligent streaming experience.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  behaviorTrackingService,
  predictiveCacheEngine,
  cacheWarmingService,
  streamCacheService,
  PredictionScore,
  WarmingStats,
  CacheStats,
} from '@/services/cache';

// =============================================================================
// TYPES
// =============================================================================

export interface SmartCacheStats {
  predictions: PredictionScore[];
  warming: WarmingStats;
  cache: CacheStats;
  behavior: {
    sessionDuration: number;
    channelsViewed: number;
    patternsLearned: number;
  };
}

export interface UseSmartCacheOptions {
  profileId?: string;
  enabled?: boolean;
  autoWarm?: boolean;
  lowBandwidthMode?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  stream_url: string;
  category_id?: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSmartCache({
  profileId,
  enabled = true,
  autoWarm = true,
  lowBandwidthMode = false,
}: UseSmartCacheOptions = {}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [stats, setStats] = useState<SmartCacheStats | null>(null);
  const [predictions, setPredictions] = useState<PredictionScore[]>([]);
  const channelListRef = useRef<Channel[]>([]);
  const currentContextRef = useRef<{
    channelId?: string;
    categoryId?: string;
  }>({});

  // Initialize services
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      try {
        // Initialize behavior tracking
        if (profileId) {
          await behaviorTrackingService.initialize(profileId);
        }

        // Initialize cache warming
        await cacheWarmingService.initialize({
          enabled: autoWarm,
          lowBandwidthMode,
        });

        setIsInitialized(true);
        console.log('[SmartCache] Initialized');
      } catch (err) {
        console.error('[SmartCache] Initialization failed:', err);
      }
    };

    init();

    return () => {
      behaviorTrackingService.cleanup();
      cacheWarmingService.cleanup();
    };
  }, [enabled, profileId, autoWarm, lowBandwidthMode]);

  // Update stats periodically
  useEffect(() => {
    if (!isInitialized) return;

    const updateStats = () => {
      const warmingStats = cacheWarmingService.getStats();
      const cacheStats = streamCacheService.getStats();
      const behaviorStats = behaviorTrackingService.getStats();

      setStats({
        predictions,
        warming: warmingStats,
        cache: cacheStats,
        behavior: {
          sessionDuration: behaviorStats.sessionDuration,
          channelsViewed: behaviorStats.channelsViewed,
          patternsLearned: behaviorStats.patternsLearned,
        },
      });
    };

    const interval = setInterval(updateStats, 5000);
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [isInitialized, predictions]);

  /**
   * Set channel list for predictions
   */
  const setChannelList = useCallback((channels: Channel[]) => {
    channelListRef.current = channels;
  }, []);

  /**
   * Track channel view and update predictions
   */
  const trackChannelView = useCallback(async (
    channelId: string,
    categoryId?: string
  ) => {
    if (!isInitialized) return;

    // Track behavior
    behaviorTrackingService.trackChannelView(channelId, categoryId);

    // Update context
    currentContextRef.current = { channelId, categoryId };

    // Get new predictions
    const newPredictions = await predictiveCacheEngine.getPredictions({
      currentChannelId: channelId,
      currentCategoryId: categoryId,
      channelList: channelListRef.current,
      profileId,
    });

    setPredictions(newPredictions);

    // Queue predictions for warming
    if (autoWarm) {
      cacheWarmingService.queuePredictions(
        newPredictions,
        channelListRef.current
      );
    }

    console.log('[SmartCache] Tracked view, predictions:', newPredictions.length);
  }, [isInitialized, profileId, autoWarm]);

  /**
   * Track watch duration
   */
  const trackWatchDuration = useCallback((
    channelId: string,
    durationSeconds: number
  ) => {
    if (!isInitialized) return;
    behaviorTrackingService.trackWatchDuration(channelId, durationSeconds);
  }, [isInitialized]);

  /**
   * Get predicted channels for preloading
   */
  const getPredictedChannels = useCallback(async (): Promise<{
    high: Channel[];
    medium: Channel[];
    low: Channel[];
  }> => {
    if (!isInitialized) {
      return { high: [], medium: [], low: [] };
    }

    const priority = await predictiveCacheEngine.getPreloadPriority({
      currentChannelId: currentContextRef.current.channelId,
      currentCategoryId: currentContextRef.current.categoryId,
      channelList: channelListRef.current,
      profileId,
    });

    const findChannel = (id: string) => 
      channelListRef.current.find(c => c.id === id);

    return {
      high: priority.high.map(findChannel).filter(Boolean) as Channel[],
      medium: priority.medium.map(findChannel).filter(Boolean) as Channel[],
      low: priority.low.map(findChannel).filter(Boolean) as Channel[],
    };
  }, [isInitialized, profileId]);

  /**
   * Check if manifest is cached
   */
  const isManifestCached = useCallback(async (url: string): Promise<boolean> => {
    const cached = await streamCacheService.getManifest(url);
    return cached !== null;
  }, []);

  /**
   * Get cached manifest
   */
  const getCachedManifest = useCallback(async (url: string): Promise<string | null> => {
    return streamCacheService.getManifest(url);
  }, []);

  /**
   * Warm a specific URL immediately
   */
  const warmUrl = useCallback(async (url: string, channelId: string): Promise<boolean> => {
    return cacheWarmingService.warmNow(url, channelId);
  }, []);

  /**
   * Pause cache warming (e.g., during playback)
   */
  const pauseWarming = useCallback(() => {
    cacheWarmingService.pause();
  }, []);

  /**
   * Resume cache warming
   */
  const resumeWarming = useCallback(() => {
    cacheWarmingService.resume();
  }, []);

  /**
   * Set low bandwidth mode
   */
  const setLowBandwidth = useCallback((enabled: boolean) => {
    cacheWarmingService.setLowBandwidthMode(enabled);
  }, []);

  /**
   * Clear all cache
   */
  const clearCache = useCallback(async () => {
    await cacheWarmingService.clearCache();
    predictiveCacheEngine.clearCache();
  }, []);

  /**
   * Get behavioral insights
   */
  const getInsights = useCallback(() => {
    return {
      peakHours: behaviorTrackingService.getPeakHours(),
      preferredCategories: behaviorTrackingService.getPreferredCategories(),
      stats: behaviorTrackingService.getStats(),
    };
  }, []);

  return {
    // State
    isInitialized,
    stats,
    predictions,

    // Channel management
    setChannelList,
    trackChannelView,
    trackWatchDuration,

    // Cache operations
    getPredictedChannels,
    isManifestCached,
    getCachedManifest,
    warmUrl,
    clearCache,

    // Warming control
    pauseWarming,
    resumeWarming,
    setLowBandwidth,

    // Insights
    getInsights,
  };
}

export default useSmartCache;
