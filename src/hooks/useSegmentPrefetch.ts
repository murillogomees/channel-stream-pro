/**
 * useSegmentPrefetch - Prefetch 1-2 HLS segments on hover/start
 */

import { useCallback, useRef } from 'react';
import Hls from 'hls.js';

interface PrefetchConfig {
  /** Number of segments to prefetch (default: 2) */
  segmentsCount: number;
  /** Prefetch on hover (default: true) */
  prefetchOnHover: boolean;
  /** Prefetch on stream start (default: true) */
  prefetchOnStart: boolean;
}

const DEFAULT_CONFIG: PrefetchConfig = {
  segmentsCount: 2,
  prefetchOnHover: true,
  prefetchOnStart: true,
};

interface PrefetchState {
  isPrefetching: boolean;
  prefetchedUrls: Set<string>;
  prefetchCount: number;
}

export function useSegmentPrefetch(config: Partial<PrefetchConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const stateRef = useRef<PrefetchState>({
    isPrefetching: false,
    prefetchedUrls: new Set(),
    prefetchCount: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Parse HLS manifest to extract segment URLs
   */
  const parseManifestForSegments = useCallback(async (
    manifestUrl: string,
    count: number
  ): Promise<string[]> => {
    try {
      const response = await fetch(manifestUrl);
      const manifestText = await response.text();
      const lines = manifestText.split('\n');
      
      // Get base URL for relative segment URLs
      const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
      
      // Check if this is a master playlist
      const isVariant = lines.some(line => line.includes('#EXT-X-STREAM-INF'));
      
      if (isVariant) {
        // Parse variant playlist - get first quality stream
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('#EXT-X-STREAM-INF') && lines[i + 1]) {
            const variantUrl = lines[i + 1].startsWith('http') 
              ? lines[i + 1] 
              : baseUrl + lines[i + 1];
            return parseManifestForSegments(variantUrl.trim(), count);
          }
        }
        return [];
      }

      // Parse media playlist - extract segment URLs
      const segments: string[] = [];
      for (const line of lines) {
        if (line && !line.startsWith('#') && (line.endsWith('.ts') || line.endsWith('.m4s'))) {
          const segmentUrl = line.startsWith('http') ? line : baseUrl + line;
          segments.push(segmentUrl.trim());
          if (segments.length >= count) break;
        }
      }

      return segments;
    } catch (error) {
      console.warn('[SegmentPrefetch] Error parsing manifest:', error);
      return [];
    }
  }, []);

  /**
   * Prefetch segment using fetch with cache
   */
  const prefetchSegment = useCallback(async (
    url: string,
    signal?: AbortSignal
  ): Promise<boolean> => {
    if (stateRef.current.prefetchedUrls.has(url)) {
      return true; // Already prefetched
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal,
        cache: 'force-cache', // Use browser cache
      });
      
      if (response.ok) {
        stateRef.current.prefetchedUrls.add(url);
        stateRef.current.prefetchCount++;
        return true;
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.warn('[SegmentPrefetch] Failed to prefetch:', url);
      }
    }
    return false;
  }, []);

  /**
   * Prefetch initial segments from HLS URL
   */
  const prefetchFromUrl = useCallback(async (hlsUrl: string): Promise<void> => {
    if (stateRef.current.isPrefetching) return;
    
    stateRef.current.isPrefetching = true;
    abortControllerRef.current = new AbortController();

    try {
      console.log('[SegmentPrefetch] Starting prefetch for:', hlsUrl);
      
      const segments = await parseManifestForSegments(hlsUrl, mergedConfig.segmentsCount);
      
      // Prefetch segments in parallel
      const prefetchPromises = segments.map(segment => 
        prefetchSegment(segment, abortControllerRef.current?.signal)
      );
      
      await Promise.allSettled(prefetchPromises);
      
      console.log(
        `[SegmentPrefetch] Prefetched ${stateRef.current.prefetchCount} segments`
      );
    } catch (error) {
      console.warn('[SegmentPrefetch] Prefetch error:', error);
    } finally {
      stateRef.current.isPrefetching = false;
    }
  }, [parseManifestForSegments, prefetchSegment, mergedConfig.segmentsCount]);

  /**
   * Prefetch segments from HLS instance
   */
  const prefetchFromHls = useCallback(async (hls: Hls): Promise<void> => {
    if (stateRef.current.isPrefetching || !hls.url) return;
    
    // Use HLS.js internal preloading
    hls.config.maxBufferLength = Math.max(hls.config.maxBufferLength || 30, 10);
    
    // Trigger segment loading
    if (hls.media && hls.media.paused) {
      hls.startLoad();
    }

    console.log('[SegmentPrefetch] Triggered HLS preload');
  }, []);

  /**
   * Handle hover event for prefetch
   */
  const onHover = useCallback((hlsUrl: string) => {
    if (!mergedConfig.prefetchOnHover) return;
    prefetchFromUrl(hlsUrl);
  }, [mergedConfig.prefetchOnHover, prefetchFromUrl]);

  /**
   * Handle stream start for prefetch
   */
  const onStart = useCallback((hlsOrUrl: Hls | string) => {
    if (!mergedConfig.prefetchOnStart) return;
    
    if (typeof hlsOrUrl === 'string') {
      prefetchFromUrl(hlsOrUrl);
    } else {
      prefetchFromHls(hlsOrUrl);
    }
  }, [mergedConfig.prefetchOnStart, prefetchFromUrl, prefetchFromHls]);

  /**
   * Cancel ongoing prefetch
   */
  const cancelPrefetch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stateRef.current.isPrefetching = false;
  }, []);

  /**
   * Clear prefetch cache
   */
  const clearCache = useCallback(() => {
    stateRef.current.prefetchedUrls.clear();
    stateRef.current.prefetchCount = 0;
  }, []);

  return {
    onHover,
    onStart,
    cancelPrefetch,
    clearCache,
    isPrefetching: stateRef.current.isPrefetching,
    prefetchCount: stateRef.current.prefetchCount,
  };
}

export default useSegmentPrefetch;
