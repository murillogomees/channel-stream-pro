/**
 * useMovieMetadata - Hook to fetch and cache movie metadata from TMDB
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ContentMetadata } from '../types';

interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  runtime?: number;
  genres?: { id: number; name: string }[];
  cast?: { name: string; character: string; profile_url?: string }[];
  director?: string;
  trailer_url?: string;
  trailer_key?: string;
  similar?: { results: TMDBMovie[] };
  recommendations?: { results: TMDBMovie[] };
}

interface UseMovieMetadataResult {
  metadata: ContentMetadata | null;
  tmdbData: TMDBMovie | null;
  isLoading: boolean;
  error: string | null;
  fetchMetadata: (contentId: string, contentName: string) => Promise<ContentMetadata | null>;
  fetchTMDBDetails: (tmdbId: string | number) => Promise<TMDBMovie | null>;
  searchTMDB: (query: string, type?: 'movie' | 'tv') => Promise<TMDBMovie[]>;
  getTrending: (type?: 'movie' | 'tv', timeWindow?: 'day' | 'week') => Promise<TMDBMovie[]>;
  getPopular: (type?: 'movie' | 'tv') => Promise<TMDBMovie[]>;
}

export function useMovieMetadata(): UseMovieMetadataResult {
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [tmdbData, setTmdbData] = useState<TMDBMovie | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Call TMDB edge function
  const callTMDB = useCallback(async (body: Record<string, any>) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tmdb', {
        body,
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('[useMovieMetadata] TMDB call error:', err);
      throw err;
    }
  }, []);

  // Search TMDB
  const searchTMDB = useCallback(async (
    query: string, 
    type: 'movie' | 'tv' = 'movie'
  ): Promise<TMDBMovie[]> => {
    // Validate query before calling API
    const trimmedQuery = query?.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }
    
    try {
      const data = await callTMDB({ action: 'search', type, query: trimmedQuery });
      return data?.results || [];
    } catch (err) {
      console.error('[useMovieMetadata] Search error:', err);
      return [];
    }
  }, [callTMDB]);

  // Get TMDB details
  const fetchTMDBDetails = useCallback(async (
    tmdbId: string | number
  ): Promise<TMDBMovie | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await callTMDB({ action: 'details', type: 'movie', id: tmdbId.toString() });
      setTmdbData(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar detalhes');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [callTMDB]);

  // Get trending
  const getTrending = useCallback(async (
    type: 'movie' | 'tv' = 'movie',
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<TMDBMovie[]> => {
    try {
      const data = await callTMDB({ action: 'trending', type, timeWindow });
      return data?.results || [];
    } catch (err) {
      console.error('[useMovieMetadata] Trending error:', err);
      return [];
    }
  }, [callTMDB]);

  // Get popular
  const getPopular = useCallback(async (
    type: 'movie' | 'tv' = 'movie'
  ): Promise<TMDBMovie[]> => {
    try {
      const data = await callTMDB({ action: 'popular', type });
      return data?.results || [];
    } catch (err) {
      console.error('[useMovieMetadata] Popular error:', err);
      return [];
    }
  }, [callTMDB]);

  // Fetch and cache metadata
  const fetchMetadata = useCallback(async (
    contentId: string,
    contentName: string
  ): Promise<ContentMetadata | null> => {
    // Validate inputs
    if (!contentId || !contentName || contentName.trim().length < 2) {
      return null;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const { data: cached } = await supabase
        .from('content_metadata')
        .select('*')
        .eq('content_id', contentId)
        .single();

      if (cached) {
        const meta = cached as unknown as ContentMetadata;
        setMetadata(meta);
        return meta;
      }

      // Search TMDB
      const searchResults = await searchTMDB(contentName, 'movie');
      
      if (!searchResults || searchResults.length === 0) {
        return null;
      }

      // Get details for best match
      const bestMatch = searchResults[0];
      const details = await callTMDB({ 
        action: 'details', 
        type: 'movie', 
        id: bestMatch.id.toString() 
      });

      if (!details) return null;

      // Build metadata
      const newMetadata: Partial<ContentMetadata> = {
        content_id: contentId,
        content_type: 'movie',
        title: details.title || details.name || contentName,
        original_title: details.original_title,
        description: details.overview,
        poster_url: details.poster_url,
        backdrop_url: details.backdrop_url,
        trailer_url: details.trailer_url,
        year: details.release_date 
          ? parseInt(details.release_date.split('-')[0]) 
          : undefined,
        duration_minutes: details.runtime,
        genres: details.genres?.map((g: any) => g.name),
        tmdb_id: details.id?.toString(),
        tmdb_rating: details.vote_average,
        cast_members: details.cast,
        director: details.director,
      };

      // Cache metadata - wrap in try/catch to not block on save errors
      try {
        const insertData = {
          content_id: newMetadata.content_id as string,
          content_type: newMetadata.content_type as string,
          title: newMetadata.title as string,
          original_title: newMetadata.original_title,
          description: newMetadata.description,
          poster_url: newMetadata.poster_url,
          backdrop_url: newMetadata.backdrop_url,
          trailer_url: newMetadata.trailer_url,
          year: newMetadata.year,
          duration_minutes: newMetadata.duration_minutes,
          genres: newMetadata.genres,
          tmdb_id: newMetadata.tmdb_id,
          tmdb_rating: newMetadata.tmdb_rating,
          cast_members: (newMetadata.cast_members || []) as any,
          director: newMetadata.director,
        };

        await supabase
          .from('content_metadata')
          .insert(insertData);
      } catch (saveError) {
        console.warn('[useMovieMetadata] Cache save error:', saveError);
      }

      const result = newMetadata as ContentMetadata;
      setMetadata(result);
      return result;

    } catch (err: any) {
      setError(err.message || 'Erro ao buscar metadata');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [searchTMDB, callTMDB]);

  return {
    metadata,
    tmdbData,
    isLoading,
    error,
    fetchMetadata,
    fetchTMDBDetails,
    searchTMDB,
    getTrending,
    getPopular,
  };
}
