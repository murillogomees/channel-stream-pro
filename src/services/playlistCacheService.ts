/**
 * Playlist Cache Service
 * Uses IndexedDB to cache M3U playlists locally for instant loading
 */

const DB_NAME = 'iptv_cache';
const DB_VERSION = 1;
const STORE_NAME = 'playlists';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedPlaylist {
  id: string;
  url: string;
  channels: any[];
  totalChannels: number;
  cachedAt: number;
  expiresAt: number;
}

class PlaylistCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[PlaylistCache] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Get cached playlist by URL
   */
  async getByUrl(url: string): Promise<CachedPlaylist | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('url');

      return new Promise((resolve, reject) => {
        const request = index.get(url);
        
        request.onsuccess = () => {
          const result = request.result as CachedPlaylist | undefined;
          
          if (!result) {
            resolve(null);
            return;
          }

          // Check if expired
          if (Date.now() > result.expiresAt) {
            console.log('[PlaylistCache] Cache expired, will refresh');
            resolve(null);
            return;
          }

          console.log(`[PlaylistCache] Cache hit! ${result.channels.length} channels`);
          resolve(result);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[PlaylistCache] Error getting cache:', error);
      return null;
    }
  }

  /**
   * Save playlist to cache
   */
  async save(url: string, channels: any[], totalChannels: number): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const cacheEntry: CachedPlaylist = {
        id: this.hashUrl(url),
        url,
        channels,
        totalChannels,
        cachedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      return new Promise((resolve, reject) => {
        const request = store.put(cacheEntry);
        request.onsuccess = () => {
          console.log(`[PlaylistCache] Saved ${channels.length} channels to cache`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[PlaylistCache] Error saving cache:', error);
    }
  }

  /**
   * Update cache with more channels (append)
   */
  async appendChannels(url: string, newChannels: any[], totalChannels: number): Promise<void> {
    try {
      const existing = await this.getByUrl(url);
      const existingChannels = existing?.channels || [];
      
      // Merge channels, avoiding duplicates by ID
      const existingIds = new Set(existingChannels.map(c => c.id));
      const uniqueNewChannels = newChannels.filter(c => !existingIds.has(c.id));
      const mergedChannels = [...existingChannels, ...uniqueNewChannels];

      await this.save(url, mergedChannels, totalChannels);
    } catch (error) {
      console.error('[PlaylistCache] Error appending to cache:', error);
    }
  }

  /**
   * Clear expired caches
   */
  async clearExpired(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiresAt');
      const now = Date.now();

      const request = index.openCursor(IDBKeyRange.upperBound(now));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } catch (error) {
      console.error('[PlaylistCache] Error clearing expired cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          console.log('[PlaylistCache] Cache cleared');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[PlaylistCache] Error clearing cache:', error);
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ count: number; totalChannels: number }> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const playlists = request.result as CachedPlaylist[];
          resolve({
            count: playlists.length,
            totalChannels: playlists.reduce((sum, p) => sum + p.channels.length, 0),
          });
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[PlaylistCache] Error getting stats:', error);
      return { count: 0, totalChannels: 0 };
    }
  }

  private hashUrl(url: string): string {
    // Simple hash for URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `playlist_${Math.abs(hash)}`;
  }
}

export const playlistCacheService = new PlaylistCacheService();
