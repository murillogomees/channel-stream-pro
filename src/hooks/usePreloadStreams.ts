/**
 * ============================================================================
 * usePreloadStreams - Netflix-style stream preloading
 * ============================================================================
 * 
 * Pré-carrega manifests e segmentos iniciais de canais próximos
 * para reduzir tempo de startup quando o usuário trocar de canal.
 */

import { useCallback, useRef, useEffect } from 'react';

interface PreloadedStream {
  url: string;
  manifest?: string;
  firstSegment?: ArrayBuffer;
  loadedAt: number;
}

const PRELOAD_CACHE_TTL = 30000; // 30 seconds
const MAX_PRELOADED = 3;

export function usePreloadStreams() {
  const preloadCache = useRef<Map<string, PreloadedStream>>(new Map());
  const preloadQueue = useRef<string[]>([]);

  // Clean expired entries
  const cleanExpired = useCallback(() => {
    const now = Date.now();
    preloadCache.current.forEach((entry, url) => {
      if (now - entry.loadedAt > PRELOAD_CACHE_TTL) {
        preloadCache.current.delete(url);
      }
    });
  }, []);

  // Preload a stream manifest
  const preloadManifest = useCallback(async (url: string): Promise<void> => {
    if (preloadCache.current.has(url)) return;
    
    // Limit cache size
    if (preloadCache.current.size >= MAX_PRELOADED) {
      const oldest = [...preloadCache.current.entries()]
        .sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0];
      if (oldest) {
        preloadCache.current.delete(oldest[0]);
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const manifest = await response.text();
        
        preloadCache.current.set(url, {
          url,
          manifest,
          loadedAt: Date.now(),
        });

        console.log('[Preload] Cached manifest:', url.substring(0, 50));
      }
    } catch (err) {
      // Silently fail - preloading is optional
      console.debug('[Preload] Failed to preload:', url.substring(0, 50));
    }
  }, []);

  // Preload multiple streams (e.g., adjacent channels)
  const preloadStreams = useCallback((urls: string[]) => {
    cleanExpired();
    
    // Queue new URLs
    const newUrls = urls.filter(url => !preloadCache.current.has(url));
    
    // Preload in background
    newUrls.slice(0, MAX_PRELOADED).forEach(url => {
      preloadManifest(url);
    });
  }, [preloadManifest, cleanExpired]);

  // Get preloaded manifest if available
  const getPreloaded = useCallback((url: string): string | null => {
    const entry = preloadCache.current.get(url);
    if (entry && Date.now() - entry.loadedAt < PRELOAD_CACHE_TTL) {
      console.log('[Preload] Cache hit:', url.substring(0, 50));
      return entry.manifest || null;
    }
    return null;
  }, []);

  // Clear all preloaded data
  const clearPreload = useCallback(() => {
    preloadCache.current.clear();
    preloadQueue.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPreload();
    };
  }, [clearPreload]);

  return {
    preloadStreams,
    preloadManifest,
    getPreloaded,
    clearPreload,
    preloadedCount: preloadCache.current.size,
  };
}

export default usePreloadStreams;
