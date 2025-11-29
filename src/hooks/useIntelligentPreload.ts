/**
 * ============================================================================
 * useIntelligentPreload - Smart Stream Preloading Hook
 * ============================================================================
 * 
 * Combines intelligent preload service with manifest preloading
 * for Netflix-style instant channel switching.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { intelligentPreloadService, PreloadCandidate } from '@/services/intelligentPreloadService';

interface PreloadedManifest {
  url: string;
  manifest: string;
  loadedAt: number;
}

interface PreloadStats {
  preloaded: number;
  cacheHits: number;
  cacheMisses: number;
}

interface PreloadContext {
  currentChannelId?: string;
  currentCategoryId?: string;
  channelList?: Array<{ id: string; stream_url: string; name: string }>;
  profileId?: string;
}

const MANIFEST_CACHE_TTL = 30000; // 30 seconds
const MAX_CONCURRENT_PRELOADS = 3;
const PRELOAD_DEBOUNCE_MS = 500;

export function useIntelligentPreload() {
  const [candidates, setCandidates] = useState<PreloadCandidate[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const [stats, setStats] = useState<PreloadStats>({ preloaded: 0, cacheHits: 0, cacheMisses: 0 });
  
  const manifestCache = useRef<Map<string, PreloadedManifest>>(new Map());
  const preloadQueue = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  /**
   * Clean expired manifests from cache
   */
  const cleanExpiredManifests = useCallback(() => {
    const now = Date.now();
    manifestCache.current.forEach((entry, url) => {
      if (now - entry.loadedAt > MANIFEST_CACHE_TTL) {
        manifestCache.current.delete(url);
      }
    });
  }, []);

  /**
   * Preload a single manifest
   */
  const preloadManifest = useCallback(async (
    url: string, 
    signal?: AbortSignal
  ): Promise<boolean> => {
    // Skip if already cached
    const cached = manifestCache.current.get(url);
    if (cached && Date.now() - cached.loadedAt < MANIFEST_CACHE_TTL) {
      return true;
    }

    // Skip if already preloading
    if (preloadQueue.current.has(url)) {
      return false;
    }

    preloadQueue.current.add(url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: signal || controller.signal,
        headers: { 'Accept': '*/*' },
        mode: 'cors',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const manifest = await response.text();
        
        manifestCache.current.set(url, {
          url,
          manifest,
          loadedAt: Date.now(),
        });

        setStats(prev => ({ ...prev, preloaded: prev.preloaded + 1 }));
        console.log('[IntelligentPreload] ✓ Cached:', url.substring(0, 60));
        return true;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.debug('[IntelligentPreload] Failed:', url.substring(0, 60));
      }
    } finally {
      preloadQueue.current.delete(url);
    }

    return false;
  }, []);

  /**
   * Preload multiple streams with priority
   */
  const preloadStreams = useCallback(async (candidates: PreloadCandidate[]) => {
    cleanExpiredManifests();
    setIsPreloading(true);

    // Cancel previous preloads
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    // Preload high priority first, then medium
    const sorted = [...candidates].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Limit concurrent preloads
    const toPreload = sorted.slice(0, MAX_CONCURRENT_PRELOADS);
    
    await Promise.allSettled(
      toPreload.map(c => preloadManifest(c.url, abortController.current?.signal))
    );

    setIsPreloading(false);
  }, [cleanExpiredManifests, preloadManifest]);

  /**
   * Update preload context (triggers intelligent preloading)
   */
  const updateContext = useCallback(async (context: PreloadContext) => {
    // Debounce rapid context changes
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      const newCandidates = await intelligentPreloadService.getPreloadCandidates(context);
      setCandidates(newCandidates);
      
      if (newCandidates.length > 0) {
        await preloadStreams(newCandidates);
      }
    }, PRELOAD_DEBOUNCE_MS);
  }, [preloadStreams]);

  /**
   * Get cached manifest for a URL
   */
  const getCachedManifest = useCallback((url: string): string | null => {
    const entry = manifestCache.current.get(url);
    if (entry && Date.now() - entry.loadedAt < MANIFEST_CACHE_TTL) {
      setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
      console.log('[IntelligentPreload] Cache HIT:', url.substring(0, 60));
      return entry.manifest;
    }
    setStats(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
    return null;
  }, []);

  /**
   * Check if a URL is preloaded
   */
  const isPreloaded = useCallback((url: string): boolean => {
    const entry = manifestCache.current.get(url);
    return !!entry && Date.now() - entry.loadedAt < MANIFEST_CACHE_TTL;
  }, []);

  /**
   * Manually preload a specific URL
   */
  const preloadUrl = useCallback(async (url: string): Promise<boolean> => {
    return preloadManifest(url);
  }, [preloadManifest]);

  /**
   * Clear all preloaded data
   */
  const clearCache = useCallback(() => {
    manifestCache.current.clear();
    preloadQueue.current.clear();
    intelligentPreloadService.clearCache();
    setCandidates([]);
    setStats({ preloaded: 0, cacheHits: 0, cacheMisses: 0 });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
      clearCache();
    };
  }, [clearCache]);

  return {
    // State
    candidates,
    isPreloading,
    stats,
    cacheSize: manifestCache.current.size,
    
    // Actions
    updateContext,
    getCachedManifest,
    isPreloaded,
    preloadUrl,
    clearCache,
  };
}

export default useIntelligentPreload;
