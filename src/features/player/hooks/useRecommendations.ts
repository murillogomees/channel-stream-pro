/**
 * useRecommendations - Hook for personalized recommendations
 */

import { useState, useEffect, useCallback } from 'react';
import { recommendationsService } from '../services/recommendationsService';
import type { RecommendationGroup } from '../types';

export function useRecommendations(limit = 20) {
  const [groups, setGroups] = useState<RecommendationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await recommendationsService.getRecommendations(limit);
      setGroups(data);
    } catch (err) {
      console.error('[useRecommendations] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load recommendations'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return {
    groups,
    isLoading,
    error,
    refresh: loadRecommendations,
  };
}

export default useRecommendations;
