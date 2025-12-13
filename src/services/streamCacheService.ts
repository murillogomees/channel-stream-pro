/**
 * ============================================================================
 * Stream Cache Service - Service Worker Integration
 * ============================================================================
 * 
 * Gerencia cache de manifests e segmentos de streaming via Service Worker.
 * Implementa estratégias de cache para playback offline-first.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CacheConfig {
  manifestTTL: number;      // ms
  segmentTTL: number;       // ms
  maxCacheSize: number;     // bytes
  maxManifests: number;
  maxSegments: number;
}

export interface CacheStats {
  manifestsCached: number;
  segmentsCached: number;
  totalSize: number;
  hitRate: number;
  hits: number;
  misses: number;
}

export interface CachedItem {
  url: string;
  size: number;
  cachedAt: number;
  expiresAt: number;
  type: 'manifest' | 'segment';
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  manifestTTL: 30 * 1000,      // 30 seconds
  segmentTTL: 60 * 1000,       // 1 minute
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  maxManifests: 10,
  maxSegments: 50,
};

// =============================================================================
// CACHE NAMES
// =============================================================================

const CACHE_NAMES = {
  manifests: 'stream-manifests-v1',
  segments: 'stream-segments-v1',
};

// =============================================================================
// STREAM CACHE SERVICE CLASS
// =============================================================================

class StreamCacheService {
  private config: CacheConfig = DEFAULT_CONFIG;
  private stats: CacheStats = {
    manifestsCached: 0,
    segmentsCached: 0,
    totalSize: 0,
    hitRate: 0,
    hits: 0,
    misses: 0,
  };
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'caches' in window;
    if (!this.isSupported) {
      console.warn('[StreamCache] Cache API not supported');
    }
  }

  /**
   * Initialize cache service
   */
  async init(config: Partial<CacheConfig> = {}): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.isSupported) return;

    // Clean expired items on init
    await this.cleanExpired();
    await this.updateStats();
  }

  /**
   * Cache a manifest
   */
  async cacheManifest(url: string, content: string): Promise<void> {
    if (!this.isSupported) return;

    try {
      const cache = await caches.open(CACHE_NAMES.manifests);
      
      // Check manifest limit
      const keys = await cache.keys();
      if (keys.length >= this.config.maxManifests) {
        // Remove oldest
        await cache.delete(keys[0]);
      }

      const response = new Response(content, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'X-Cached-At': Date.now().toString(),
          'X-Expires-At': (Date.now() + this.config.manifestTTL).toString(),
        },
      });

      await cache.put(url, response);
      this.stats.manifestsCached++;
    } catch (err) {
      console.error('[StreamCache] Failed to cache manifest:', err);
    }
  }

  /**
   * Get cached manifest
   */
  async getManifest(url: string): Promise<string | null> {
    if (!this.isSupported) {
      this.stats.misses++;
      return null;
    }

    try {
      const cache = await caches.open(CACHE_NAMES.manifests);
      const response = await cache.match(url);

      if (!response) {
        this.stats.misses++;
        return null;
      }

      // Check expiration
      const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0');
      if (Date.now() > expiresAt) {
        await cache.delete(url);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      
      return await response.text();
    } catch (err) {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache a segment
   */
  async cacheSegment(url: string, data: ArrayBuffer): Promise<void> {
    if (!this.isSupported) return;

    try {
      const cache = await caches.open(CACHE_NAMES.segments);
      
      // Check segment limit
      const keys = await cache.keys();
      if (keys.length >= this.config.maxSegments) {
        // Remove oldest
        await cache.delete(keys[0]);
      }

      // Check size limit
      if (this.stats.totalSize + data.byteLength > this.config.maxCacheSize) {
        await this.evictOldest('segment');
      }

      const response = new Response(data, {
        headers: {
          'Content-Type': 'video/mp2t',
          'X-Cached-At': Date.now().toString(),
          'X-Expires-At': (Date.now() + this.config.segmentTTL).toString(),
          'X-Size': data.byteLength.toString(),
        },
      });

      await cache.put(url, response);
      this.stats.segmentsCached++;
      this.stats.totalSize += data.byteLength;
    } catch (err) {
      console.error('[StreamCache] Failed to cache segment:', err);
    }
  }

  /**
   * Get cached segment
   */
  async getSegment(url: string): Promise<ArrayBuffer | null> {
    if (!this.isSupported) {
      this.stats.misses++;
      return null;
    }

    try {
      const cache = await caches.open(CACHE_NAMES.segments);
      const response = await cache.match(url);

      if (!response) {
        this.stats.misses++;
        return null;
      }

      // Check expiration
      const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0');
      if (Date.now() > expiresAt) {
        const size = parseInt(response.headers.get('X-Size') || '0');
        await cache.delete(url);
        this.stats.totalSize -= size;
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      
      return await response.arrayBuffer();
    } catch (err) {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Prefetch segments for a manifest
   */
  async prefetchSegments(manifestUrl: string, manifest: string, count: number = 3): Promise<void> {
    if (!this.isSupported) return;

    // Parse manifest for segment URLs
    const segmentUrls = this.parseSegmentUrls(manifestUrl, manifest);
    const toPrefetch = segmentUrls.slice(0, count);

    await Promise.all(toPrefetch.map(async (url) => {
      try {
        // Check if already cached
        const cached = await this.getSegment(url);
        if (cached) return;

        // Fetch and cache
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.arrayBuffer();
          await this.cacheSegment(url, data);
        }
      } catch (err) {
        // Silent fail for prefetch
      }
    }));
  }

  /**
   * Parse segment URLs from manifest
   */
  private parseSegmentUrls(manifestUrl: string, manifest: string): string[] {
    const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
    const urls: string[] = [];

    const lines = manifest.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        if (trimmed.startsWith('http')) {
          urls.push(trimmed);
        } else {
          urls.push(baseUrl + trimmed);
        }
      }
    }

    return urls;
  }

  /**
   * Clean expired items
   */
  async cleanExpired(): Promise<void> {
    if (!this.isSupported) return;

    const now = Date.now();

    // Clean manifests
    try {
      const manifestCache = await caches.open(CACHE_NAMES.manifests);
      const manifestKeys = await manifestCache.keys();
      
      for (const request of manifestKeys) {
        const response = await manifestCache.match(request);
        if (response) {
          const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0');
          if (now > expiresAt) {
            await manifestCache.delete(request);
            this.stats.manifestsCached--;
          }
        }
      }
    } catch (err) {
      console.error('[StreamCache] Error cleaning manifests:', err);
    }

    // Clean segments
    try {
      const segmentCache = await caches.open(CACHE_NAMES.segments);
      const segmentKeys = await segmentCache.keys();
      
      for (const request of segmentKeys) {
        const response = await segmentCache.match(request);
        if (response) {
          const expiresAt = parseInt(response.headers.get('X-Expires-At') || '0');
          if (now > expiresAt) {
            const size = parseInt(response.headers.get('X-Size') || '0');
            await segmentCache.delete(request);
            this.stats.segmentsCached--;
            this.stats.totalSize -= size;
          }
        }
      }
    } catch (err) {
      console.error('[StreamCache] Error cleaning segments:', err);
    }

    // Expired items cleaned
  }

  /**
   * Evict oldest items
   */
  private async evictOldest(type: 'manifest' | 'segment'): Promise<void> {
    const cacheName = type === 'manifest' ? CACHE_NAMES.manifests : CACHE_NAMES.segments;
    
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      
      if (keys.length > 0) {
        const response = await cache.match(keys[0]);
        if (response && type === 'segment') {
          const size = parseInt(response.headers.get('X-Size') || '0');
          this.stats.totalSize -= size;
        }
        await cache.delete(keys[0]);
        
        if (type === 'manifest') {
          this.stats.manifestsCached--;
        } else {
          this.stats.segmentsCached--;
        }
      }
    } catch (err) {
      console.error('[StreamCache] Error evicting:', err);
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;
  }

  /**
   * Update stats from cache
   */
  async updateStats(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const manifestCache = await caches.open(CACHE_NAMES.manifests);
      const segmentCache = await caches.open(CACHE_NAMES.segments);
      
      const manifestKeys = await manifestCache.keys();
      const segmentKeys = await segmentCache.keys();
      
      this.stats.manifestsCached = manifestKeys.length;
      this.stats.segmentsCached = segmentKeys.length;

      // Calculate total size
      let totalSize = 0;
      for (const request of segmentKeys) {
        const response = await segmentCache.match(request);
        if (response) {
          totalSize += parseInt(response.headers.get('X-Size') || '0');
        }
      }
      this.stats.totalSize = totalSize;
    } catch (err) {
      console.error('[StreamCache] Error updating stats:', err);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    if (!this.isSupported) return;

    try {
      await caches.delete(CACHE_NAMES.manifests);
      await caches.delete(CACHE_NAMES.segments);
      
      this.stats = {
        manifestsCached: 0,
        segmentsCached: 0,
        totalSize: 0,
        hitRate: 0,
        hits: 0,
        misses: 0,
      };
    } catch (err) {
      console.error('[StreamCache] Error clearing caches:', err);
    }
  }

  /**
   * Check if supported
   */
  isAvailable(): boolean {
    return this.isSupported;
  }

  /**
   * Format size for display
   */
  formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const streamCacheService = new StreamCacheService();
export default streamCacheService;
