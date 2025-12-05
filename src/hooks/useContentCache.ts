/**
 * Content Cache Hook - 24h cache for stable content display
 * Prevents constant re-fetching and content shuffling
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_KEY_PREFIX = 'iptv_content_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface UseContentCacheOptions {
  key: string;
  version?: string;
}

export function useContentCache<T>({ key, version = '1' }: UseContentCacheOptions) {
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);
  
  const cacheKey = `${CACHE_KEY_PREFIX}${key}`;

  // Load from cache on mount - only once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        const now = Date.now();
        const age = now - entry.timestamp;
        
        // Valid cache: same version and not expired
        if (entry.version === version && age < CACHE_TTL_MS) {
          setCachedData(entry.data);
          setIsFromCache(true);
          setIsLoading(false);
          console.log(`[ContentCache] Loaded ${key} from cache (age: ${Math.round(age / 60000)}min)`);
          return;
        } else {
          // Expired or version mismatch - clear it
          localStorage.removeItem(cacheKey);
          console.log(`[ContentCache] Cache expired or version mismatch for ${key}`);
        }
      }
    } catch (e) {
      console.warn('[ContentCache] Error reading cache:', e);
      localStorage.removeItem(cacheKey);
    }
    
    setIsLoading(false);
  }, [cacheKey, version]);

  // Save to cache
  const saveToCache = useCallback((data: T) => {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version,
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
      setCachedData(data);
      setIsFromCache(true);
      console.log(`[ContentCache] Saved ${key} to cache`);
    } catch (e) {
      console.warn('[ContentCache] Error saving to cache:', e);
    }
  }, [cacheKey, key, version]);

  // Clear cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(cacheKey);
    setCachedData(null);
    setIsFromCache(false);
    initRef.current = false;
    console.log(`[ContentCache] Cleared cache for ${key}`);
  }, [cacheKey, key]);

  // Get cache age in hours
  const getCacheAge = useCallback((): number | null => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        return (Date.now() - entry.timestamp) / (60 * 60 * 1000);
      }
    } catch (e) {}
    return null;
  }, [cacheKey]);

  // Time until next refresh
  const getTimeUntilRefresh = useCallback((): string => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        const expiresAt = entry.timestamp + CACHE_TTL_MS;
        const remaining = expiresAt - Date.now();
        
        if (remaining > 0) {
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          return `${hours}h ${minutes}min`;
        }
      }
    } catch (e) {}
    return 'Agora';
  }, [cacheKey]);

  return {
    cachedData,
    isFromCache,
    isLoading,
    saveToCache,
    clearCache,
    getCacheAge,
    getTimeUntilRefresh,
    hasValidCache: isFromCache && cachedData !== null,
  };
}

// Utility to clear all content caches
export function clearAllContentCaches() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
  console.log(`[ContentCache] Cleared ${keys.length} caches`);
}
