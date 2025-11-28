/**
 * TMDB Service - Fetch movie/series metadata from TMDB API
 */

import { supabase } from '@/integrations/supabase/client';
import type { ContentMetadata, ContentType, CastMember } from '../types';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
}

interface TMDBDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  runtime?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  imdb_id?: string;
  credits?: {
    cast?: { name: string; character: string; profile_path?: string }[];
    crew?: { name: string; job: string }[];
  };
  videos?: {
    results?: { type: string; site: string; key: string }[];
  };
  production_countries?: { iso_3166_1: string; name: string }[];
  spoken_languages?: { iso_639_1: string; name: string }[];
}

// Helper to map DB content metadata to typed metadata
function mapDbMetadata(data: any): ContentMetadata {
  return {
    id: data.id,
    content_id: data.content_id,
    content_type: data.content_type as ContentType,
    title: data.title,
    original_title: data.original_title,
    description: data.description,
    poster_url: data.poster_url,
    backdrop_url: data.backdrop_url,
    trailer_url: data.trailer_url,
    year: data.year,
    duration_minutes: data.duration_minutes,
    genres: data.genres,
    imdb_id: data.imdb_id,
    imdb_rating: data.imdb_rating,
    tmdb_id: data.tmdb_id,
    tmdb_rating: data.tmdb_rating,
    cast_members: Array.isArray(data.cast_members) ? data.cast_members as CastMember[] : [],
    director: data.director,
    country: data.country,
    language: data.language,
  };
}

class TMDBService {
  private apiKey: string | null = null;
  private genreMap: Map<number, string> = new Map();

  /**
   * Initialize with API key (should be stored in Supabase secrets)
   */
  async init(): Promise<void> {
    // API key would come from environment or Supabase config
    // For now, we'll use a placeholder that should be configured
    this.apiKey = ''; // Set your TMDB API key
    
    // Load genre map
    await this.loadGenres();
  }

  /**
   * Load genre mapping from TMDB
   */
  private async loadGenres(): Promise<void> {
    if (!this.apiKey || this.genreMap.size > 0) return;

    try {
      const movieGenres = await this.fetchFromTMDB('/genre/movie/list');
      const tvGenres = await this.fetchFromTMDB('/genre/tv/list');

      for (const genre of [...(movieGenres?.genres || []), ...(tvGenres?.genres || [])]) {
        this.genreMap.set(genre.id, genre.name);
      }
    } catch (error) {
      console.error('[TMDBService] Error loading genres:', error);
    }
  }

  /**
   * Fetch from TMDB API
   */
  private async fetchFromTMDB(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    if (!this.apiKey) return null;

    const url = new URL(`${TMDB_API_BASE}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('language', 'pt-BR');
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`TMDB API error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[TMDBService] Fetch error:', error);
      return null;
    }
  }

  /**
   * Search for movie/series
   */
  async search(
    query: string,
    type: 'movie' | 'series' = 'movie'
  ): Promise<TMDBSearchResult[]> {
    const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
    const data = await this.fetchFromTMDB(endpoint, { query });
    return data?.results || [];
  }

  /**
   * Get detailed info for movie/series
   */
  async getDetails(
    tmdbId: string | number,
    type: 'movie' | 'series'
  ): Promise<TMDBDetails | null> {
    const endpoint = type === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    return await this.fetchFromTMDB(endpoint, {
      append_to_response: 'credits,videos,external_ids',
    });
  }

  /**
   * Get or fetch metadata for content
   */
  async getMetadata(
    contentId: string,
    contentName: string,
    contentType: ContentType
  ): Promise<ContentMetadata | null> {
    // Check cache first
    const { data: cached } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('content_id', contentId)
      .single();

    if (cached) {
      return mapDbMetadata(cached);
    }

    // Only fetch for movies/series
    if (contentType === 'live' || contentType === 'episode') {
      return null;
    }

    // Search TMDB
    const type = contentType === 'movie' ? 'movie' : 'series';
    const searchResults = await this.search(contentName, type);
    
    if (!searchResults || searchResults.length === 0) {
      return null;
    }

    // Get details for best match
    const bestMatch = searchResults[0];
    const details = await this.getDetails(bestMatch.id, type);
    
    if (!details) return null;

    // Build metadata object
    const metadata: Record<string, any> = {
      content_id: contentId,
      content_type: contentType,
      title: details.title || details.name || contentName,
      original_title: details.original_title || details.original_name,
      description: details.overview,
      poster_url: details.poster_path 
        ? `${TMDB_IMAGE_BASE}/w500${details.poster_path}` 
        : null,
      backdrop_url: details.backdrop_path 
        ? `${TMDB_IMAGE_BASE}/original${details.backdrop_path}` 
        : null,
      year: details.release_date 
        ? parseInt(details.release_date.split('-')[0])
        : details.first_air_date 
          ? parseInt(details.first_air_date.split('-')[0])
          : null,
      duration_minutes: details.runtime || (details.episode_run_time?.[0]) || null,
      genres: details.genres?.map(g => g.name) || [],
      imdb_id: details.imdb_id || null,
      tmdb_id: details.id.toString(),
      tmdb_rating: details.vote_average || null,
      country: details.production_countries?.[0]?.name || null,
      language: details.spoken_languages?.[0]?.name || null,
    };

    // Extract cast
    if (details.credits?.cast) {
      metadata.cast_members = details.credits.cast.slice(0, 10).map(c => ({
        name: c.name,
        character: c.character,
        profile_url: c.profile_path 
          ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}` 
          : null,
      }));
    } else {
      metadata.cast_members = [];
    }

    // Extract director
    if (details.credits?.crew) {
      const director = details.credits.crew.find(c => c.job === 'Director');
      if (director) {
        metadata.director = director.name;
      }
    }

    // Extract trailer
    if (details.videos?.results) {
      const trailer = details.videos.results.find(
        v => v.type === 'Trailer' && v.site === 'YouTube'
      );
      if (trailer) {
        metadata.trailer_url = `https://www.youtube.com/watch?v=${trailer.key}`;
      }
    }

    // Cache the metadata
    const insertData = {
      content_id: metadata.content_id,
      content_type: metadata.content_type,
      title: metadata.title,
      original_title: metadata.original_title,
      description: metadata.description,
      poster_url: metadata.poster_url,
      backdrop_url: metadata.backdrop_url,
      trailer_url: metadata.trailer_url,
      year: metadata.year,
      duration_minutes: metadata.duration_minutes,
      genres: metadata.genres,
      imdb_id: metadata.imdb_id,
      tmdb_id: metadata.tmdb_id,
      tmdb_rating: metadata.tmdb_rating,
      cast_members: metadata.cast_members,
      director: metadata.director,
      country: metadata.country,
      language: metadata.language,
    };

    const { data: saved, error } = await supabase
      .from('content_metadata')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[TMDBService] Error caching metadata:', error);
      return mapDbMetadata(metadata);
    }

    return mapDbMetadata(saved);
  }

  /**
   * Get poster URL
   */
  getPosterUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }

  /**
   * Get backdrop URL
   */
  getBackdropUrl(path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }
}

export const tmdbService = new TMDBService();
export default tmdbService;
