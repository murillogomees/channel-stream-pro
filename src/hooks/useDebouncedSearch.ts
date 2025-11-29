/**
 * ============================================================================
 * useDebouncedSearch - Performance Optimized Search Hook
 * ============================================================================
 * 
 * Debounces search input to prevent excessive re-renders and API calls.
 * Recommended debounce time: 300ms for typing, 150ms for filters.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface UseDebouncedSearchOptions<T> {
  /** Debounce delay in milliseconds (default: 300ms) */
  delay?: number;
  /** Minimum characters to trigger search (default: 0) */
  minChars?: number;
  /** Filter function to apply on items */
  filterFn?: (item: T, query: string) => boolean;
  /** Transform query before searching (e.g., lowercase) */
  transformQuery?: (query: string) => string;
}

interface UseDebouncedSearchReturn<T> {
  /** Current search query (immediate) */
  query: string;
  /** Debounced search query */
  debouncedQuery: string;
  /** Set the search query */
  setQuery: (value: string) => void;
  /** Clear the search query */
  clearQuery: () => void;
  /** Is currently debouncing */
  isDebouncing: boolean;
  /** Filtered items (if filterFn provided) */
  filteredItems: T[];
  /** Number of filtered items */
  resultCount: number;
}

export function useDebouncedSearch<T = unknown>(
  items: T[] = [],
  options: UseDebouncedSearchOptions<T> = {}
): UseDebouncedSearchReturn<T> {
  const {
    delay = 300,
    minChars = 0,
    filterFn,
    transformQuery = (q) => q.toLowerCase().trim(),
  } = options;

  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set query with debouncing
  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setIsDebouncing(true);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced value after delay
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setIsDebouncing(false);
    }, delay);
  }, [delay]);

  // Clear query
  const clearQuery = useCallback(() => {
    setQueryState('');
    setDebouncedQuery('');
    setIsDebouncing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Filter items based on debounced query
  const filteredItems = useMemo(() => {
    const transformed = transformQuery(debouncedQuery);
    
    // Return all items if query is too short
    if (transformed.length < minChars) {
      return items;
    }

    // Return all items if no filter function
    if (!filterFn) {
      return items;
    }

    // Apply filter
    return items.filter((item) => filterFn(item, transformed));
  }, [items, debouncedQuery, minChars, filterFn, transformQuery]);

  return {
    query,
    debouncedQuery,
    setQuery,
    clearQuery,
    isDebouncing,
    filteredItems,
    resultCount: filteredItems.length,
  };
}

/**
 * Simple debounced value hook (for non-search use cases)
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedSearch;
