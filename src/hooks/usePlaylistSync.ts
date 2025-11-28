/**
 * ============================================================================
 * usePlaylistSync Hook
 * ============================================================================
 * 
 * React hook for loading and managing playlist data with caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  playlistSyncService, 
  PlaylistChannel, 
  SyncProgress, 
  CachedPlaylist 
} from '@/services/playlistSyncService';

export interface UsePlaylistSyncOptions {
  /** Auto-load on mount */
  autoLoad?: boolean;
  /** Force refresh from server */
  forceRefresh?: boolean;
}

export interface UsePlaylistSyncReturn {
  /** All loaded channels */
  channels: PlaylistChannel[];
  /** Unique categories */
  categories: string[];
  /** Loading state */
  isLoading: boolean;
  /** Loading more data */
  isLoadingMore: boolean;
  /** Error state */
  error: Error | null;
  /** Sync progress */
  progress: SyncProgress | null;
  /** Whether data came from cache */
  isCached: boolean;
  /** Playlist metadata */
  metadata: CachedPlaylist['metadata'] | null;
  /** Load/refresh playlist */
  loadPlaylist: (forceRefresh?: boolean) => Promise<void>;
  /** Clear cache and reload */
  clearCacheAndReload: () => Promise<void>;
  /** Search channels */
  search: (query: string) => Promise<PlaylistChannel[]>;
  /** Filter channels by category */
  filterByCategory: (category: string | null) => PlaylistChannel[];
}

export function usePlaylistSync(
  playlistKey: string,
  options: UsePlaylistSyncOptions = {}
): UsePlaylistSyncReturn {
  const { autoLoad = true, forceRefresh = false } = options;

  const [playlist, setPlaylist] = useState<CachedPlaylist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isCached, setIsCached] = useState(false);

  const loadedRef = useRef(false);
  const mountedRef = useRef(true);

  // Load playlist
  const loadPlaylist = useCallback(async (force = false) => {
    if (!playlistKey) return;

    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      const result = await playlistSyncService.getPlaylist(playlistKey, {
        forceRefresh: force || forceRefresh,
        onProgress: (p) => {
          if (mountedRef.current) {
            setProgress(p);
            setIsCached(p.fromCache);
            setIsLoadingMore(p.phase === 'downloading' && p.loaded > 0);
          }
        },
      });

      if (mountedRef.current) {
        setPlaylist(result);
        setIsCached(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        console.error('[usePlaylistSync] Load error:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [playlistKey, forceRefresh]);

  // Clear cache and reload
  const clearCacheAndReload = useCallback(async () => {
    await playlistSyncService.clearCache(playlistKey);
    setIsCached(false);
    await loadPlaylist(true);
  }, [playlistKey, loadPlaylist]);

  // Search
  const search = useCallback(async (query: string): Promise<PlaylistChannel[]> => {
    if (!query || query.length < 2) return [];
    return playlistSyncService.search(query, playlistKey);
  }, [playlistKey]);

  // Filter by category
  const filterByCategory = useCallback((category: string | null): PlaylistChannel[] => {
    if (!playlist?.channels) return [];
    if (!category) return playlist.channels;
    return playlist.channels.filter(c => c.category_name === category);
  }, [playlist]);

  // Auto-load on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoLoad && !loadedRef.current && playlistKey) {
      loadedRef.current = true;
      loadPlaylist();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoLoad, playlistKey, loadPlaylist]);

  return {
    channels: playlist?.channels || [],
    categories: playlist?.categories || [],
    isLoading,
    isLoadingMore,
    error,
    progress,
    isCached,
    metadata: playlist?.metadata || null,
    loadPlaylist,
    clearCacheAndReload,
    search,
    filterByCategory,
  };
}

export default usePlaylistSync;
