/**
 * useTrending - Hook for trending content
 */

import { useState, useEffect, useCallback } from 'react';
import { recommendationsService } from '../services/recommendationsService';
import type { TrendingItem, RankingType, ContentType } from '../types';

export function useTrending(
  rankingType: RankingType = 'weekly',
  contentType?: ContentType,
  limit = 10
) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await recommendationsService.getTrending(rankingType, contentType, limit);
      setItems(data);
    } catch (err) {
      console.error('[useTrending] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load trending'));
    } finally {
      setIsLoading(false);
    }
  }, [rankingType, contentType, limit]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  return {
    items,
    isLoading,
    error,
    refresh: loadTrending,
  };
}

export default useTrending;
