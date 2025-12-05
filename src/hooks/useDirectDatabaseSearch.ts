/**
 * Direct Database Search Hook
 * Queries m3u_sync_entries directly for ultra-fast background search
 * No blocking, no waiting for render - pure background operation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DirectSearchResult {
  id: string;
  title: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  tvg_name: string | null;
  group_title: string;
  content_type: string | null;
}

interface UseDirectDatabaseSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
}

export function useDirectDatabaseSearch(options: UseDirectDatabaseSearchOptions = {}) {
  const {
    debounceMs = 200,
    minQueryLength = 2,
    limit = 50,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { results: DirectSearchResult[]; count: number; timestamp: number }>>(new Map());

  // Background search - non-blocking
  const searchDatabase = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim().toLowerCase();
    
    if (trimmed.length < minQueryLength) {
      setResults([]);
      setTotalCount(0);
      setIsSearching(false);
      return;
    }

    // Check cache (5 minute TTL)
    const cached = cacheRef.current.get(trimmed);
    if (cached && Date.now() - cached.timestamp < 300000) {
      setResults(cached.results);
      setTotalCount(cached.count);
      setIsSearching(false);
      return;
    }

    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      // Use ilike for case-insensitive search across multiple fields
      const searchPattern = `%${trimmed}%`;
      
      const { data, error, count } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, stream_url, tvg_logo, tvg_id, tvg_name, group_title, content_type', { count: 'estimated' })
        .or(`title.ilike.${searchPattern},group_title.ilike.${searchPattern},tvg_name.ilike.${searchPattern}`)
        .limit(limit)
        .abortSignal(abortRef.current.signal);

      if (error) throw error;

      const searchResults: DirectSearchResult[] = (data || []).map(entry => ({
        id: entry.id,
        title: entry.title || '',
        stream_url: entry.stream_url || '',
        tvg_logo: entry.tvg_logo,
        tvg_id: entry.tvg_id,
        tvg_name: entry.tvg_name,
        group_title: entry.group_title || 'Sem categoria',
        content_type: entry.content_type,
      }));

      // Cache results
      cacheRef.current.set(trimmed, {
        results: searchResults,
        count: count || searchResults.length,
        timestamp: Date.now(),
      });

      // Limit cache size
      if (cacheRef.current.size > 100) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) cacheRef.current.delete(firstKey);
      }

      setResults(searchResults);
      setTotalCount(count || searchResults.length);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[DirectSearch] Error:', err.message);
      setResults([]);
      setTotalCount(0);
    } finally {
      setIsSearching(false);
    }
  }, [limit, minQueryLength]);

  // Debounced query update
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!newQuery || newQuery.trim().length < minQueryLength) {
      setResults([]);
      setTotalCount(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Background search with debounce
    debounceRef.current = setTimeout(() => {
      searchDatabase(newQuery);
    }, debounceMs);
  }, [searchDatabase, debounceMs, minQueryLength]);

  // Immediate search (no debounce)
  const searchNow = useCallback((searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setQuery(searchQuery);
    setIsSearching(true);
    searchDatabase(searchQuery);
  }, [searchDatabase]);

  // Clear everything
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setTotalCount(0);
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
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
    hasResults: results.length > 0,
  };
}
