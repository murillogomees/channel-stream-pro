/**
 * useContinueWatching - Hook for continue watching functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { watchProgressService } from '../services/watchProgressService';
import type { WatchProgress, ContentType } from '../types';

export function useContinueWatching() {
  const [items, setItems] = useState<WatchProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadContinueWatching = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await watchProgressService.getContinueWatching(20);
      setItems(data);
    } catch (error) {
      console.error('[useContinueWatching] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContinueWatching();
  }, [loadContinueWatching]);

  const updateProgress = useCallback(async (
    contentId: string,
    contentType: ContentType,
    contentName: string,
    progressSeconds: number,
    durationSeconds: number,
    options?: { contentLogo?: string; contentCategory?: string }
  ) => {
    await watchProgressService.updateProgress(
      contentId, contentType, contentName,
      progressSeconds, durationSeconds, options
    );
    // Refresh list
    loadContinueWatching();
  }, [loadContinueWatching]);

  const removeItem = useCallback(async (contentId: string) => {
    await watchProgressService.removeFromContinueWatching(contentId);
    setItems(prev => prev.filter(item => item.content_id !== contentId));
  }, []);

  return {
    items,
    isLoading,
    updateProgress,
    removeItem,
    refresh: loadContinueWatching,
  };
}

export default useContinueWatching;
