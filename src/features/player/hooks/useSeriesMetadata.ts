/**
 * useSeriesMetadata - Hook for fetching series metadata from TMDB
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SeriesMetadata, Episode } from '../types/series';

export function useSeriesMetadata() {
  const fetchSeriesMetadata = useCallback(async (
    contentId: string,
    seriesName: string
  ): Promise<SeriesMetadata | null> => {
    try {
      // Check cache first
      const { data: cached } = await supabase
        .from('content_metadata')
        .select('*')
        .eq('content_id', contentId)
        .eq('content_type', 'series')
        .maybeSingle();

      // If cached and recent (< 7 days), return it
      if (cached && cached.fetched_at) {
        const fetchedAt = new Date(cached.fetched_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        if (fetchedAt > weekAgo) {
          return transformCachedToMetadata(cached, contentId);
        }
      }

      // Fetch from TMDB via edge function
      const cleanedName = cleanSeriesName(seriesName);
      
      // Validate query before calling API
      if (!cleanedName || cleanedName.length < 2) {
        return cached ? transformCachedToMetadata(cached, contentId) : null;
      }
      
      const { data, error } = await supabase.functions.invoke('fetch-tmdb', {
        body: {
          action: 'search',
          type: 'tv',
          query: cleanedName,
        },
      });

      if (error) {
        console.error('[useSeriesMetadata] Edge function error:', error);
        return cached ? transformCachedToMetadata(cached, contentId) : null;
      }

      // Get first result and fetch details
      if (data?.results && data.results.length > 0) {
        const firstResult = data.results[0];
        
        // Fetch full details
        const { data: detailsData, error: detailsError } = await supabase.functions.invoke('fetch-tmdb', {
          body: {
            action: 'details',
            type: 'tv',
            id: String(firstResult.id),
          },
        });

        if (!detailsError && detailsData) {
          const metadata = transformTMDBResponse(detailsData, contentId);
          
          // Cache the result
          try {
            await supabase.from('content_metadata').upsert({
              content_id: contentId,
              content_type: 'series',
              title: metadata.title,
              original_title: metadata.original_title,
              description: metadata.description,
              poster_url: metadata.poster_url,
              backdrop_url: metadata.backdrop_url,
              year: metadata.year,
              genres: metadata.genres,
              tmdb_id: metadata.tmdb_id,
              tmdb_rating: metadata.tmdb_rating,
              cast_members: metadata.cast_members as any,
              director: metadata.creator,
              country: metadata.country,
              language: metadata.language,
              fetched_at: new Date().toISOString(),
            }, { onConflict: 'content_id' });
          } catch (cacheError) {
            console.warn('[useSeriesMetadata] Cache error:', cacheError);
          }
          
          return metadata;
        }
      }

      return null;
    } catch (err) {
      console.error('[useSeriesMetadata] Error:', err);
      return null;
    }
  }, []);

  const fetchSeasonDetails = useCallback(async (
    tmdbId: string,
    seasonNumber: number
  ): Promise<Episode[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tmdb', {
        body: {
          action: 'season',
          type: 'tv',
          id: tmdbId,
          seasonNumber,
        },
      });

      if (error || !data) return null;
      return data.episodes || [];
    } catch (err) {
      console.error('[useSeriesMetadata] Season fetch error:', err);
      return null;
    }
  }, []);

  return {
    fetchSeriesMetadata,
    fetchSeasonDetails,
  };
}

// Helper functions
function cleanSeriesName(name: string): string {
  return name
    .replace(/\s*S\d{1,2}\s*E\d{1,3}/gi, '') // Remove S01E01 patterns
    .replace(/\s*\d{1,2}x\d{1,3}/gi, '') // Remove 1x01 patterns
    .replace(/\s*-\s*Temporada\s*\d+/gi, '') // Remove "- Temporada X"
    .replace(/\s*Temporada\s*\d+/gi, '') // Remove "Temporada X"
    .replace(/\s*Season\s*\d+/gi, '') // Remove "Season X"
    .replace(/\s*T\d+\s*$/gi, '') // Remove "T1" at end
    .replace(/\s*\(\d{4}\)/g, '') // Remove (2024)
    .replace(/\s*\[.*?\]/g, '') // Remove [tags]
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

function transformCachedToMetadata(cached: any, contentId: string): SeriesMetadata {
  return {
    id: cached.id,
    content_id: contentId,
    tmdb_id: cached.tmdb_id,
    imdb_id: cached.imdb_id,
    title: cached.title,
    original_title: cached.original_title,
    description: cached.description,
    poster_url: cached.poster_url,
    backdrop_url: cached.backdrop_url,
    year: cached.year,
    genres: cached.genres,
    tmdb_rating: cached.tmdb_rating,
    cast_members: cached.cast_members as any,
    creator: cached.director,
    country: cached.country,
    language: cached.language,
  };
}

function transformTMDBResponse(data: any, contentId: string): SeriesMetadata {
  const baseImageUrl = 'https://image.tmdb.org/t/p';
  
  return {
    id: `tmdb_${data.id}`,
    content_id: contentId,
    tmdb_id: String(data.id),
    title: data.name,
    original_title: data.original_name,
    description: data.overview,
    poster_url: data.poster_path ? `${baseImageUrl}/w500${data.poster_path}` : data.poster_url,
    backdrop_url: data.backdrop_path ? `${baseImageUrl}/original${data.backdrop_path}` : data.backdrop_url,
    year: data.first_air_date ? parseInt(data.first_air_date.substring(0, 4)) : undefined,
    status: data.status,
    genres: data.genres?.map((g: any) => g.name),
    tmdb_rating: data.vote_average,
    vote_count: data.vote_count,
    total_seasons: data.number_of_seasons,
    total_episodes: data.number_of_episodes,
    seasons: data.seasons?.map((s: any) => ({
      season_number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      air_date: s.air_date,
      overview: s.overview,
      poster_url: s.poster_path ? `${baseImageUrl}/w300${s.poster_path}` : undefined,
    })),
    cast_members: data.cast || data.credits?.cast?.slice(0, 10).map((c: any) => ({
      name: c.name,
      character: c.character,
      profile_url: c.profile_path ? `${baseImageUrl}/w185${c.profile_path}` : undefined,
    })),
    creator: data.creator || data.created_by?.[0]?.name,
    networks: data.networks?.map((n: any) => n.name),
    country: data.origin_country?.[0],
    language: data.original_language,
  };
}
