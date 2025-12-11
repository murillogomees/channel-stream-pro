/**
 * Hook for backend-powered search across all playlist content
 * Searches directly in the database, not limited to loaded content
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SUPABASE_FUNCTIONS_URL } from '@/config/supabase';

interface SearchResult {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_name: string;
  rank?: number;
}

interface UseBackendSearchOptions {
  playlistKey?: string;
  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
}

export function useBackendSearch(options: UseBackendSearchOptions = {}) {
  const {
    playlistKey = 'lista-vip',
    debounceMs = 300,
    minQueryLength = 2,
    limit = 100,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string, category?: string) => {
    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!searchQuery || searchQuery.length < minQueryLength) {
      setResults([]);
      setTotalResults(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || '';
      
      const params = new URLSearchParams({
        q: searchQuery,
        limit: String(limit),
      });
      
      if (playlistKey) {
        params.append('playlist', playlistKey);
      }
      if (category) {
        params.append('category', category);
      }

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/playlist-serve/search?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Transform to SearchResult format
      const transformedResults: SearchResult[] = (data.entries || []).map((entry: any) => ({
        id: entry.id,
        name: entry.title,
        stream_url: entry.stream_url,
        tvg_logo: entry.tvg_logo,
        tvg_id: entry.tvg_id,
        category_name: entry.group_title || 'Sem categoria',
        rank: entry.rank,
      }));

      setResults(transformedResults);
      setTotalResults(data.total || transformedResults.length);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      console.error('[BackendSearch] Error:', err);
      setError('Erro ao buscar conteúdo');
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  }, [playlistKey, limit, minQueryLength]);

  // Debounced search
  const debouncedSearch = useCallback((searchQuery: string, category?: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery || searchQuery.length < minQueryLength) {
      setResults([]);
      setTotalResults(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    debounceRef.current = setTimeout(() => {
      search(searchQuery, category);
    }, debounceMs);
  }, [search, debounceMs, minQueryLength]);

  // Update query and trigger search
  const updateQuery = useCallback((newQuery: string, category?: string) => {
    setQuery(newQuery);
    debouncedSearch(newQuery, category);
  }, [debouncedSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setTotalResults(0);
    setError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    results,
    isSearching,
    totalResults,
    error,
    updateQuery,
    search,
    clearSearch,
    hasResults: results.length > 0,
    isActive: query.length >= minQueryLength,
  };
}
