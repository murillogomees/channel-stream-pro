/**
 * useMLPreloader - ML-based predictive preloading hook
 * Uses behavioral patterns to intelligently preload likely next content
 */

import { useCallback, useEffect, useRef } from 'react';
import { mlPredictionEngine, type PredictionResult } from '@/services/smartPrefetch/mlPredictionEngine';

interface UseMLPreloaderOptions {
  /** Currently playing channel ID */
  currentChannelId: string | null;
  /** All available channel IDs */
  allChannelIds: string[];
  /** Function to preload a channel */
  onPreload: (channelId: string, priority: 'high' | 'medium' | 'low') => void;
  /** Whether preloading is enabled */
  enabled?: boolean;
  /** Max channels to preload */
  maxPreloads?: number;
}

export function useMLPreloader({
  currentChannelId,
  allChannelIds,
  onPreload,
  enabled = true,
  maxPreloads = 3,
}: UseMLPreloaderOptions) {
  const preloadedRef = useRef<Set<string>>(new Set());
  const lastChannelRef = useRef<string | null>(null);
  const viewStartRef = useRef<number>(0);

  // Record view when channel changes
  useEffect(() => {
    if (!enabled) return;

    // Record duration for previous channel
    if (lastChannelRef.current && viewStartRef.current > 0) {
      const duration = (Date.now() - viewStartRef.current) / 1000;
      mlPredictionEngine.recordView(lastChannelRef.current, duration);
    }

    // Start tracking new channel
    if (currentChannelId) {
      viewStartRef.current = Date.now();
      lastChannelRef.current = currentChannelId;
    }
  }, [currentChannelId, enabled]);

  // Trigger preloading based on predictions
  useEffect(() => {
    if (!enabled || !currentChannelId || allChannelIds.length === 0) return;

    const priorities = mlPredictionEngine.getPreloadPriorities(currentChannelId, allChannelIds);

    let preloadCount = 0;

    // Preload high priority first
    for (const channelId of priorities.high) {
      if (preloadCount >= maxPreloads) break;
      if (!preloadedRef.current.has(channelId)) {
        onPreload(channelId, 'high');
        preloadedRef.current.add(channelId);
        preloadCount++;
      }
    }

    // Then medium priority
    for (const channelId of priorities.medium) {
      if (preloadCount >= maxPreloads) break;
      if (!preloadedRef.current.has(channelId)) {
        onPreload(channelId, 'medium');
        preloadedRef.current.add(channelId);
        preloadCount++;
      }
    }
  }, [currentChannelId, allChannelIds, enabled, maxPreloads, onPreload]);

  // Clear preloaded cache when channel list changes significantly
  useEffect(() => {
    preloadedRef.current.clear();
  }, [allChannelIds.length]);

  const getPredictions = useCallback((limit = 5): PredictionResult[] => {
    return mlPredictionEngine.getPredictions(currentChannelId, allChannelIds, limit);
  }, [currentChannelId, allChannelIds]);

  const getStats = useCallback(() => {
    return mlPredictionEngine.getStats();
  }, []);

  const clearHistory = useCallback(() => {
    mlPredictionEngine.clearData();
    preloadedRef.current.clear();
  }, []);

  return {
    getPredictions,
    getStats,
    clearHistory,
    preloadedCount: preloadedRef.current.size,
  };
}

export default useMLPreloader;
