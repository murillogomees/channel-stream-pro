/**
 * useRecommendations - Hook for personalized recommendations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { recommendationsService, SeriesContinuation } from '../services/recommendationsService';
import type { RecommendationGroup, RecommendationItem, Channel } from '../types';

interface UseRecommendationsOptions {
  allChannels: Channel[];
  enabled?: boolean;
}

export function useRecommendations({ allChannels, enabled = true }: UseRecommendationsOptions) {
  const [recommendationGroups, setRecommendationGroups] = useState<RecommendationGroup[]>([]);
  const [seriesContinuations, setSeriesContinuations] = useState<SeriesContinuation[]>([]);
  const [forYouMix, setForYouMix] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRecommendations = useCallback(async () => {
    if (!enabled || allChannels.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Load all recommendations in parallel
      const [groups, continuations, forYou] = await Promise.all([
        recommendationsService.getRecommendationsByHistory(allChannels, 20),
        recommendationsService.getSeriesContinuations(allChannels, 10),
        recommendationsService.getForYouMix(allChannels, 30),
      ]);

      setRecommendationGroups(groups);
      setSeriesContinuations(continuations);
      setForYouMix(forYou);
    } catch (err) {
      console.error('[useRecommendations] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load recommendations'));
    } finally {
      setIsLoading(false);
    }
  }, [allChannels, enabled]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Convert series continuations to channels for easy playback
  const continuationChannels = useMemo(() => {
    return seriesContinuations.map(sc => ({
      ...sc.nextEpisode,
      _seriesInfo: {
        seriesName: sc.seriesName,
        currentSeason: sc.currentSeason,
        currentEpisode: sc.currentEpisode,
        progress: sc.progress,
      },
    }));
  }, [seriesContinuations]);

  return {
    groups: recommendationGroups,
    recommendationGroups,
    seriesContinuations,
    continuationChannels,
    forYouMix,
    isLoading,
    error,
    refresh: loadRecommendations,
  };
}

export default useRecommendations;
export type { SeriesContinuation };
