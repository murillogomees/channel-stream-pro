/**
 * usePlaylistCache - Enhanced React Query + IndexedDB cache layer
 * 
 * Features:
 * - 30 min staleTime to prevent unnecessary refetches
 * - Background refresh without loading state
 * - Instant load from cache on revisit
 * - Automatic cache invalidation on version change
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';

interface CacheConfig {
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}

interface PlaylistData {
  channels: any[];
  categories: any[];
  total: number;
  version: number;
  cachedAt: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  staleTime: 1000 * 60 * 30, // 30 minutes
  cacheTime: 1000 * 60 * 60, // 1 hour in memory
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
};

const DB_NAME = 'iptv_playlist_v9';
const STORE_NAME = 'playlist_cache';

// IndexedDB helper
class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  async get(key: string): Promise<PlaylistData | null> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result?.data || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async set(key: string, data: PlaylistData): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ key, data, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Silently fail - cache is optional
    }
  }

  async clear(key: string): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Silently fail
    }
  }
}

const indexedDBCache = new IndexedDBCache();

export function usePlaylistCache(
  playlistId: string | null,
  fetchFn: () => Promise<PlaylistData>,
  config: CacheConfig = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const queryClient = useQueryClient();
  const lastFetchRef = useRef<number>(0);

  // Query with aggressive caching
  const query = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: async () => {
      // Try IndexedDB first for instant load
      const cached = playlistId ? await indexedDBCache.get(playlistId) : null;
      
      // If cached data exists and is fresh, use it
      if (cached && Date.now() - cached.cachedAt < mergedConfig.staleTime!) {
        console.log('[PlaylistCache] Using IndexedDB cache');
        return cached;
      }

      // Fetch fresh data
      const freshData = await fetchFn();
      
      // Save to IndexedDB
      if (playlistId && freshData.channels.length > 0) {
        await indexedDBCache.set(playlistId, {
          ...freshData,
          cachedAt: Date.now(),
        });
      }

      lastFetchRef.current = Date.now();
      return freshData;
    },
    enabled: !!playlistId,
    staleTime: mergedConfig.staleTime,
    gcTime: mergedConfig.cacheTime,
    refetchOnWindowFocus: mergedConfig.refetchOnWindowFocus,
    refetchOnReconnect: mergedConfig.refetchOnReconnect,
    // Keep previous data while refetching (no loading flash)
    placeholderData: (previousData) => previousData,
  });

  // Background refresh - no loading state shown
  const backgroundRefresh = useCallback(async () => {
    if (!playlistId) return;
    
    // Don't refresh if recently fetched
    if (Date.now() - lastFetchRef.current < 60000) return;

    console.log('[PlaylistCache] Background refresh started');
    
    try {
      const freshData = await fetchFn();
      
      // Update cache silently
      queryClient.setQueryData(['playlist', playlistId], freshData);
      
      // Save to IndexedDB
      await indexedDBCache.set(playlistId, {
        ...freshData,
        cachedAt: Date.now(),
      });
      
      lastFetchRef.current = Date.now();
      console.log('[PlaylistCache] Background refresh complete');
    } catch (err) {
      console.error('[PlaylistCache] Background refresh failed:', err);
    }
  }, [playlistId, fetchFn, queryClient]);

  // Clear cache and force refetch
  const clearCache = useCallback(async () => {
    if (playlistId) {
      await indexedDBCache.clear(playlistId);
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    }
  }, [playlistId, queryClient]);

  // Prefetch into cache without displaying
  const prefetch = useCallback(async (id: string, fetchFnOverride?: () => Promise<PlaylistData>) => {
    const fn = fetchFnOverride || fetchFn;
    await queryClient.prefetchQuery({
      queryKey: ['playlist', id],
      queryFn: fn,
      staleTime: mergedConfig.staleTime,
    });
  }, [queryClient, fetchFn, mergedConfig.staleTime]);

  return {
    data: query.data,
    isLoading: query.isLoading && !query.data, // Only true on initial load
    isFetching: query.isFetching,
    isStale: query.isStale,
    error: query.error,
    backgroundRefresh,
    clearCache,
    prefetch,
  };
}

export { indexedDBCache };
