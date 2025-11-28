import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLazyLoadContentOptions {
  initialCount?: number;
  incrementCount?: number;
  rootMargin?: string;
  threshold?: number;
}

export function useLazyLoadContent<T>(
  items: T[],
  options: UseLazyLoadContentOptions = {}
) {
  const {
    initialCount = 20,
    incrementCount = 20,
    rootMargin = '200px',
    threshold = 0.1,
  } = options;

  const [visibleCount, setVisibleCount] = useState(initialCount);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset visible count when items change significantly
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items.length > 0 ? items[0] : null, initialCount]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + incrementCount, items.length));
  }, [incrementCount, items.length]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && visibleCount < items.length) {
          loadMore();
        }
      },
      { rootMargin, threshold }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibleCount, items.length, loadMore, rootMargin, threshold]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const remainingCount = items.length - visibleCount;

  return {
    visibleItems,
    hasMore,
    remainingCount,
    loadMoreRef,
    loadMore,
    visibleCount,
    totalCount: items.length,
  };
}
