/**
 * useNetflixLazyLoad - Intelligent lazy loading like Netflix
 * 
 * Features:
 * - Predictive preloading based on scroll direction
 * - Skeleton placeholders during load
 * - Batch loading with priority queue
 * - Viewport-aware rendering
 * - Image preloading for upcoming items
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface UseNetflixLazyLoadOptions {
  /** Initial items to render (above the fold) */
  initialCount?: number;
  /** Items to load per batch */
  batchSize?: number;
  /** Preload items ahead of viewport */
  preloadAhead?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Enable image preloading */
  preloadImages?: boolean;
  /** Image URL extractor function */
  getImageUrl?: (item: any) => string | undefined;
  /** Enable scroll direction prediction */
  predictiveLoad?: boolean;
}

interface ScrollState {
  direction: 'up' | 'down' | 'idle';
  velocity: number;
  lastPosition: number;
  lastTime: number;
}

export function useNetflixLazyLoad<T extends { id: string }>(
  items: T[],
  options: UseNetflixLazyLoadOptions = {}
) {
  const {
    initialCount = 12,
    batchSize = 12,
    preloadAhead = 6,
    rootMargin = '600px',
    preloadImages = true,
    getImageUrl,
    predictiveLoad = true,
  } = options;

  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollStateRef = useRef<ScrollState>({
    direction: 'idle',
    velocity: 0,
    lastPosition: 0,
    lastTime: Date.now(),
  });
  const preloadQueueRef = useRef<string[]>([]);
  const rafRef = useRef<number>();

  // Memoized visible items
  const visibleItems = useMemo(() => 
    items.slice(0, visibleCount), 
    [items, visibleCount]
  );

  // Items to preload (next batch)
  const preloadItems = useMemo(() => 
    items.slice(visibleCount, visibleCount + preloadAhead),
    [items, visibleCount, preloadAhead]
  );

  // Skeleton count for loading state
  const skeletonCount = useMemo(() => {
    if (!isLoading) return 0;
    return Math.min(batchSize, items.length - visibleCount);
  }, [isLoading, batchSize, items.length, visibleCount]);

  // Compute items key for reset detection
  const itemsKey = useMemo(() => 
    items.length > 0 ? items[0]?.id : 'empty',
    [items]
  );

  // Reset on items change
  useEffect(() => {
    setVisibleCount(initialCount);
    setPreloadedImages(new Set());
    preloadQueueRef.current = [];
  }, [itemsKey, initialCount]);

  // Load more items with animation frame batching
  const loadMore = useCallback(() => {
    if (visibleCount >= items.length || isLoading) return;
    
    setIsLoading(true);
    
    // Use requestAnimationFrame for smooth loading
    rafRef.current = requestAnimationFrame(() => {
      setVisibleCount(prev => {
        const next = Math.min(prev + batchSize, items.length);
        return next;
      });
      setIsLoading(false);
    });
  }, [visibleCount, items.length, batchSize, isLoading]);

  // Predictive load based on scroll velocity
  const predictiveLoadMore = useCallback(() => {
    if (!predictiveLoad) return;
    
    const { velocity, direction } = scrollStateRef.current;
    
    // Fast scroll down - preload more aggressively
    if (direction === 'down' && velocity > 500) {
      const extraBatches = Math.ceil(velocity / 1000);
      const targetCount = Math.min(
        visibleCount + (batchSize * (1 + extraBatches)),
        items.length
      );
      
      if (targetCount > visibleCount) {
        setVisibleCount(targetCount);
      }
    }
  }, [predictiveLoad, visibleCount, batchSize, items.length]);

  // Scroll direction detection
  useEffect(() => {
    if (!predictiveLoad || !containerRef.current) return;

    const handleScroll = () => {
      const now = Date.now();
      const position = window.scrollY;
      const { lastPosition, lastTime } = scrollStateRef.current;
      
      const deltaY = position - lastPosition;
      const deltaTime = now - lastTime;
      
      if (deltaTime > 0) {
        const velocity = Math.abs(deltaY / deltaTime) * 1000; // pixels per second
        const direction = deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : 'idle';
        
        scrollStateRef.current = {
          direction,
          velocity,
          lastPosition: position,
          lastTime: now,
        };
        
        // Trigger predictive loading on fast scroll
        if (velocity > 300 && direction === 'down') {
          predictiveLoadMore();
        }
      }
    };

    // Throttled scroll handler
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [predictiveLoad, predictiveLoadMore]);

  // Image preloading for upcoming items
  useEffect(() => {
    if (!preloadImages || !getImageUrl || preloadItems.length === 0) return;

    const imagesToPreload = preloadItems
      .map(item => getImageUrl(item))
      .filter((url): url is string => !!url && !preloadedImages.has(url));

    if (imagesToPreload.length === 0) return;

    // Stagger image preloading
    imagesToPreload.forEach((url, index) => {
      setTimeout(() => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          setPreloadedImages(prev => new Set([...prev, url]));
        };
      }, index * 50); // 50ms stagger
    });
  }, [preloadItems, preloadImages, getImageUrl, preloadedImages]);

  // Intersection Observer for load trigger
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && visibleCount < items.length && !isLoading) {
          loadMore();
        }
      },
      { 
        rootMargin,
        threshold: 0.1 
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visibleCount, items.length, loadMore, rootMargin, isLoading]);

  // Check if image is preloaded
  const isImagePreloaded = useCallback((url: string | undefined) => {
    return url ? preloadedImages.has(url) : false;
  }, [preloadedImages]);

  const hasMore = visibleCount < items.length;
  const remainingCount = items.length - visibleCount;
  const progress = items.length > 0 ? (visibleCount / items.length) * 100 : 0;

  return {
    // Core data
    visibleItems,
    hasMore,
    remainingCount,
    totalCount: items.length,
    visibleCount,
    progress,
    
    // Loading state
    isLoading,
    skeletonCount,
    
    // Refs
    loadMoreRef,
    containerRef,
    
    // Actions
    loadMore,
    
    // Image preloading
    isImagePreloaded,
    preloadedCount: preloadedImages.size,
    
    // Scroll state (for debugging)
    scrollDirection: scrollStateRef.current.direction,
  };
}

export default useNetflixLazyLoad;
