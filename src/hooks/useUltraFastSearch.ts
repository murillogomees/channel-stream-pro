import { useState, useRef, useCallback, useEffect, startTransition } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FastSearchResult {
  id: string;
  title: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  tvg_name: string | null;
  group_title: string | null;
  content_type: string | null;
  is_vod: boolean | null;
}

interface CacheEntry {
  results: FastSearchResult[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

export function useUltraFastSearch(limit: number = 100) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FastSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const searchDatabase = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim().toLowerCase();

      // Clear results if empty
      if (!trimmed || trimmed.length < 2) {
        startTransition(() => {
          setResults([]);
          setTotalCount(0);
          setIsSearching(false);
        });
        return;
      }

      // Check cache first
      const cached = cacheRef.current.get(trimmed);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        startTransition(() => {
          setResults(cached.results);
          setTotalCount(cached.results.length);
          setIsSearching(false);
        });
        return;
      }

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsSearching(true);

      try {
        const { data, error } = await supabase.rpc("search_channels_fast", {
          search_term: trimmed,
          result_limit: limit,
        });

        if (error) throw error;

        const searchResults = (data || []) as FastSearchResult[];

        // Update cache (limit size)
        if (cacheRef.current.size >= MAX_CACHE_SIZE) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }
        cacheRef.current.set(trimmed, {
          results: searchResults,
          timestamp: Date.now(),
        });

        // Update state with startTransition for non-blocking UI
        startTransition(() => {
          setResults(searchResults);
          setTotalCount(searchResults.length);
          setIsSearching(false);
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Search error:", err);
          startTransition(() => {
            setIsSearching(false);
          });
        }
      }
    },
    [limit]
  );

  // Update query - no debounce here (component handles debounce)
  const updateQuery = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      
      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      
      // Execute search immediately (component already debounced)
      searchDatabase(newQuery);
    },
    [searchDatabase]
  );

  const searchNow = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      searchDatabase(searchQuery);
    },
    [searchDatabase]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setTotalCount(0);
    setIsSearching(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    query,
    results,
    isSearching,
    totalCount,
    updateQuery,
    searchNow,
    clearSearch,
  };
}
