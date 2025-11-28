// src/lib/sw/cacheStrategies.ts
// Cache management utilities for client-side

const DEBUG = new URLSearchParams(window.location.search).has('debug-cache');

function log(...args: any[]) {
  if (DEBUG) console.log('[Cache]', ...args);
}

export const CACHE_NAMES = {
  STATIC: 'static-cache-v1',
  DYNAMIC: 'dynamic-cache-v1',
  M3U: 'm3u-cache-v1',
  STREAMS: 'streams-cache-v1',
  IMAGES: 'images-cache-v1'
} as const;

export const CACHE_LIMITS = {
  [CACHE_NAMES.DYNAMIC]: 100,
  [CACHE_NAMES.M3U]: 10,
  [CACHE_NAMES.STREAMS]: 50,
  [CACHE_NAMES.IMAGES]: 200
} as const;

export async function getCacheSize(cacheName: string): Promise<number> {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function getAllCacheStats(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  for (const name of Object.values(CACHE_NAMES)) {
    stats[name] = await getCacheSize(name);
  }

  return stats;
}

export async function clearCache(cacheName: string): Promise<boolean> {
  try {
    await caches.delete(cacheName);
    log(`Cache '${cacheName}' limpo`);
    return true;
  } catch (error) {
    console.error('[Cache] Erro ao limpar:', error);
    return false;
  }
}

export async function clearAllCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  log('Todos os caches limpos');
}

export async function removeFromCache(cacheName: string, url: string): Promise<boolean> {
  try {
    const cache = await caches.open(cacheName);
    return await cache.delete(url);
  } catch {
    return false;
  }
}

export async function addToCache(cacheName: string, url: string, response?: Response): Promise<void> {
  try {
    const cache = await caches.open(cacheName);

    if (response) {
      await cache.put(url, response.clone());
    } else {
      await cache.add(url);
    }

    log(`Adicionado ao cache '${cacheName}':`, url);
  } catch (error) {
    console.error('[Cache] Erro ao adicionar:', error);
  }
}

export async function getFromCache(cacheName: string, url: string): Promise<Response | undefined> {
  try {
    const cache = await caches.open(cacheName);
    return await cache.match(url);
  } catch {
    return undefined;
  }
}

export async function precacheUrls(cacheName: string, urls: string[]): Promise<void> {
  try {
    const cache = await caches.open(cacheName);
    await cache.addAll(urls);
    log(`Precache de ${urls.length} URLs em '${cacheName}'`);
  } catch (error) {
    console.error('[Cache] Erro no precache:', error);
  }
}

// Precache common assets for the player
export async function precachePlayerAssets(): Promise<void> {
  const playerAssets = [
    '/logo.png',
    '/logo.webp',
    '/pwa-icon.png',
    '/favicon.png'
  ];

  await precacheUrls(CACHE_NAMES.STATIC, playerAssets);
}

// Cache cleanup based on limits
export async function cleanupCache(cacheName: string, maxItems: number): Promise<number> {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length <= maxItems) return 0;

    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(key => cache.delete(key)));

    log(`Cleanup de ${toDelete.length} itens em '${cacheName}'`);
    return toDelete.length;
  } catch {
    return 0;
  }
}

export async function runCacheCleanup(): Promise<void> {
  for (const [cacheName, limit] of Object.entries(CACHE_LIMITS)) {
    await cleanupCache(cacheName, limit);
  }
}

// Check if a URL is cached
export async function isCached(url: string): Promise<boolean> {
  const match = await caches.match(url);
  return !!match;
}

// Get estimated storage usage
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return null;
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
}
