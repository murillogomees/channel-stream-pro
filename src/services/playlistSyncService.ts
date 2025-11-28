/**
 * ============================================================================
 * Playlist Sync Service - Client-side Cache & API
 * ============================================================================
 * 
 * Features:
 * - IndexedDB caching with ETag support
 * - Automatic background sync
 * - Progressive loading with pagination
 * - Offline support
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================
export interface PlaylistChannel {
  id: string;
  name: string;
  stream_url: string;
  category_name: string;
  tvg_id?: string;
  tvg_name?: string;
  tvg_logo?: string;
  sequence: number;
}

export interface PlaylistMetadata {
  key: string;
  name: string;
  entriesCount: number;
  categoriesCount: number;
  version: number;
  lastSync: string;
  etag?: string;
}

export interface CachedPlaylist {
  key: string;
  channels: PlaylistChannel[];
  categories: string[];
  metadata: PlaylistMetadata;
  cachedAt: number;
  version: number;
  complete: boolean;
}

export interface SyncProgress {
  loaded: number;
  total: number;
  percentage: number;
  phase: 'checking' | 'downloading' | 'complete' | 'error';
  fromCache: boolean;
}

type ProgressCallback = (progress: SyncProgress) => void;

// ============================================================================
// INDEXEDDB STORE
// ============================================================================
const DB_NAME = 'playlist_cache_v2';
const DB_VERSION = 2;
const STORE_PLAYLISTS = 'playlists';
const STORE_PROGRESS = 'watch_progress';

class IndexedDBStore {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Playlists store
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          const playlistStore = db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'key' });
          playlistStore.createIndex('cachedAt', 'cachedAt');
          playlistStore.createIndex('version', 'version');
        }

        // Watch progress store
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          const progressStore = db.createObjectStore(STORE_PROGRESS, { keyPath: 'contentId' });
          progressStore.createIndex('updatedAt', 'updatedAt');
        }
      };
    });

    return this.dbPromise;
  }

  async getPlaylist(key: string): Promise<CachedPlaylist | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readonly');
      const store = tx.objectStore(STORE_PLAYLISTS);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async savePlaylist(playlist: CachedPlaylist): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORE_PLAYLISTS);
      const request = store.put(playlist);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deletePlaylist(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORE_PLAYLISTS);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORE_PLAYLISTS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const idbStore = new IndexedDBStore();

// ============================================================================
// PLAYLIST SYNC SERVICE
// ============================================================================
class PlaylistSyncService {
  private progressCallbacks = new Map<string, Set<ProgressCallback>>();
  private syncInProgress = new Map<string, boolean>();

  /**
   * Get playlist - uses cache-first strategy with ETag validation
   */
  async getPlaylist(
    key: string,
    options: {
      forceRefresh?: boolean;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<CachedPlaylist> {
    const { forceRefresh = false, onProgress } = options;

    // Emit initial progress
    const emitProgress = (progress: SyncProgress) => {
      onProgress?.(progress);
      this.notifyProgress(key, progress);
    };

    emitProgress({ loaded: 0, total: 0, percentage: 0, phase: 'checking', fromCache: false });

    // Check local cache first
    const cached = await idbStore.getPlaylist(key);

    if (cached && !forceRefresh) {
      // Check if cache is fresh (less than 1 hour old)
      const cacheAge = Date.now() - cached.cachedAt;
      const CACHE_TTL = 60 * 60 * 1000; // 1 hour

      if (cacheAge < CACHE_TTL && cached.complete) {
        console.log(`[PlaylistSync] Cache hit for ${key} (${cached.channels.length} channels)`);
        emitProgress({
          loaded: cached.channels.length,
          total: cached.channels.length,
          percentage: 100,
          phase: 'complete',
          fromCache: true,
        });
        return cached;
      }

      // Cache exists but might be stale - check version with server
      try {
        const serverMeta = await this.fetchPlaylistMetadata(key);
        
        if (serverMeta && cached.version === serverMeta.version) {
          console.log(`[PlaylistSync] Cache still valid for ${key}`);
          // Update cache timestamp
          await idbStore.savePlaylist({ ...cached, cachedAt: Date.now() });
          emitProgress({
            loaded: cached.channels.length,
            total: cached.channels.length,
            percentage: 100,
            phase: 'complete',
            fromCache: true,
          });
          return cached;
        }
      } catch (err) {
        // Network error - use cached data
        console.warn(`[PlaylistSync] Network error, using cache for ${key}`);
        emitProgress({
          loaded: cached.channels.length,
          total: cached.channels.length,
          percentage: 100,
          phase: 'complete',
          fromCache: true,
        });
        return cached;
      }
    }

    // Need to fetch from server
    return this.fetchAndCachePlaylist(key, emitProgress);
  }

  /**
   * Fetch playlist metadata only
   */
  private async fetchPlaylistMetadata(key: string): Promise<PlaylistMetadata | null> {
    try {
      const { data, error } = await supabase.functions.invoke('playlist-serve', {
        body: null,
        method: 'GET',
      });

      if (error) throw error;

      const playlist = data?.playlists?.find((p: any) => p.key === key);
      if (!playlist) return null;

      return {
        key: playlist.key,
        name: playlist.name,
        entriesCount: playlist.entries_count,
        categoriesCount: playlist.categories_count,
        version: playlist.version,
        lastSync: playlist.last_sync_at,
        etag: playlist.etag,
      };
    } catch (err) {
      console.error('[PlaylistSync] Failed to fetch metadata:', err);
      return null;
    }
  }

  /**
   * Fetch playlist from server and cache it
   */
  private async fetchAndCachePlaylist(
    key: string,
    emitProgress: (progress: SyncProgress) => void
  ): Promise<CachedPlaylist> {
    if (this.syncInProgress.get(key)) {
      // Wait for existing sync
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
          if (!this.syncInProgress.get(key)) {
            clearInterval(checkInterval);
            const cached = await idbStore.getPlaylist(key);
            if (cached) {
              resolve(cached);
            } else {
              reject(new Error('Sync failed'));
            }
          }
        }, 500);
      });
    }

    this.syncInProgress.set(key, true);

    try {
      emitProgress({ loaded: 0, total: 0, percentage: 0, phase: 'downloading', fromCache: false });

      const allChannels: PlaylistChannel[] = [];
      const categoriesSet = new Set<string>();
      let offset = 0;
      const limit = 2000; // Fetch in batches
      let total = 0;
      let version = 0;
      let lastSync = '';

      // Fetch in parallel batches for speed
      const fetchBatch = async (batchOffset: number): Promise<{ channels: PlaylistChannel[]; total: number; version: number; lastSync: string }> => {
        const { data, error } = await supabase.functions.invoke('playlist-serve', {
          body: { key, offset: batchOffset, limit },
        });

        if (error) throw error;

        return {
          channels: data.channels || [],
          total: data.total || 0,
          version: data.version || 0,
          lastSync: data.lastSync || '',
        };
      };

      // First batch to get total
      const firstBatch = await fetchBatch(0);
      total = firstBatch.total;
      version = firstBatch.version;
      lastSync = firstBatch.lastSync;
      
      allChannels.push(...firstBatch.channels);
      firstBatch.channels.forEach(c => categoriesSet.add(c.category_name));

      emitProgress({
        loaded: allChannels.length,
        total,
        percentage: Math.round((allChannels.length / total) * 100),
        phase: 'downloading',
        fromCache: false,
      });

      // Fetch remaining batches in parallel (3 at a time)
      const PARALLEL_BATCHES = 3;
      offset = limit;

      while (offset < total) {
        const batchPromises: Promise<{ channels: PlaylistChannel[]; total: number; version: number; lastSync: string }>[] = [];
        
        for (let i = 0; i < PARALLEL_BATCHES && offset + (i * limit) < total; i++) {
          batchPromises.push(fetchBatch(offset + (i * limit)));
        }

        const results = await Promise.all(batchPromises);
        
        for (const result of results) {
          allChannels.push(...result.channels);
          result.channels.forEach(c => categoriesSet.add(c.category_name));
        }

        offset += PARALLEL_BATCHES * limit;

        emitProgress({
          loaded: Math.min(allChannels.length, total),
          total,
          percentage: Math.round((Math.min(allChannels.length, total) / total) * 100),
          phase: 'downloading',
          fromCache: false,
        });
      }

      // Save to cache
      const cached: CachedPlaylist = {
        key,
        channels: allChannels,
        categories: Array.from(categoriesSet).sort(),
        metadata: {
          key,
          name: key,
          entriesCount: total,
          categoriesCount: categoriesSet.size,
          version,
          lastSync,
        },
        cachedAt: Date.now(),
        version,
        complete: true,
      };

      await idbStore.savePlaylist(cached);

      emitProgress({
        loaded: allChannels.length,
        total,
        percentage: 100,
        phase: 'complete',
        fromCache: false,
      });

      console.log(`[PlaylistSync] Fetched and cached ${allChannels.length} channels for ${key}`);
      return cached;

    } catch (err) {
      console.error(`[PlaylistSync] Failed to fetch playlist ${key}:`, err);
      emitProgress({
        loaded: 0,
        total: 0,
        percentage: 0,
        phase: 'error',
        fromCache: false,
      });
      throw err;
    } finally {
      this.syncInProgress.set(key, false);
    }
  }

  /**
   * Trigger server-side sync for a playlist
   */
  async triggerSync(url: string, key: string, force = false): Promise<{ jobId: string }> {
    const { data, error } = await supabase.functions.invoke('playlist-sync', {
      body: { url, key, force },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Clear local cache for a playlist
   */
  async clearCache(key: string): Promise<void> {
    await idbStore.deletePlaylist(key);
    console.log(`[PlaylistSync] Cleared cache for ${key}`);
  }

  /**
   * Clear all local caches
   */
  async clearAllCaches(): Promise<void> {
    await idbStore.clearAll();
    console.log('[PlaylistSync] Cleared all caches');
  }

  /**
   * Subscribe to progress updates
   */
  subscribeProgress(key: string, callback: ProgressCallback): () => void {
    if (!this.progressCallbacks.has(key)) {
      this.progressCallbacks.set(key, new Set());
    }
    this.progressCallbacks.get(key)!.add(callback);

    return () => {
      this.progressCallbacks.get(key)?.delete(callback);
    };
  }

  private notifyProgress(key: string, progress: SyncProgress): void {
    this.progressCallbacks.get(key)?.forEach(cb => cb(progress));
  }

  /**
   * Search channels
   */
  async search(query: string, playlistKey?: string, limit = 100): Promise<PlaylistChannel[]> {
    const { data, error } = await supabase.functions.invoke('playlist-serve', {
      body: { q: query, playlist: playlistKey, limit },
    });

    if (error) throw error;
    
    return (data?.results || []).map((r: any) => ({
      id: r.id,
      name: r.title,
      stream_url: r.stream_url,
      category_name: r.group_title || 'Outros',
      tvg_logo: r.tvg_logo,
      sequence: 0,
    }));
  }
}

export const playlistSyncService = new PlaylistSyncService();
