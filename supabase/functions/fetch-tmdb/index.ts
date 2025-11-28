/**
 * Fetch TMDB Data - Edge function to get movie/series metadata
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TMDBRequest {
  action: 'search' | 'details' | 'trending' | 'popular' | 'genres' | 'season';
  type?: 'movie' | 'tv';
  query?: string;
  id?: string;
  page?: number;
  timeWindow?: 'day' | 'week';
  seasonNumber?: number;
  // Legacy support
  tmdbId?: string;
  contentId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TMDB_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TMDBRequest = await req.json();
    let { action, type = 'movie', query, id, page = 1, timeWindow = 'week', seasonNumber, tmdbId, contentId } = body;

    // Legacy support: if tmdbId provided without action, assume season fetch
    if (tmdbId && !action && seasonNumber !== undefined) {
      action = 'season';
      id = tmdbId;
      type = 'tv';
    }
    
    // Legacy support: if query provided without action, assume search
    if (query && !action) {
      action = 'search';
    }

    let endpoint = '';
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'pt-BR',
      page: page.toString(),
    });

    switch (action) {
      case 'search':
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Query required for search' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `/search/${type}`;
        params.set('query', query);
        break;

      case 'details':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'ID required for details' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `/${type}/${id}`;
        params.set('append_to_response', 'credits,videos,similar,recommendations,external_ids');
        break;

      case 'season':
        if (!id || seasonNumber === undefined) {
          return new Response(
            JSON.stringify({ error: 'ID and seasonNumber required for season details' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `/tv/${id}/season/${seasonNumber}`;
        break;

      case 'trending':
        endpoint = `/trending/${type}/${timeWindow}`;
        break;

      case 'popular':
        endpoint = `/${type}/popular`;
        break;

      case 'genres':
        endpoint = `/genre/${type}/list`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const url = `${TMDB_API_BASE}${endpoint}?${params.toString()}`;
    console.log(`[TMDB] Fetching: ${endpoint}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TMDB] Error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'TMDB API error', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Process images to full URLs
    if (data.results) {
      data.results = data.results.map((item: any) => ({
        ...item,
        poster_url: item.poster_path ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` : null,
        backdrop_url: item.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${item.backdrop_path}` : null,
      }));
    }

    if (data.poster_path) {
      data.poster_url = `${TMDB_IMAGE_BASE}/w500${data.poster_path}`;
    }
    if (data.backdrop_path) {
      data.backdrop_url = `${TMDB_IMAGE_BASE}/original${data.backdrop_path}`;
    }

    // Process season episodes
    if (action === 'season' && data.episodes) {
      data.episodes = data.episodes.map((ep: any) => ({
        id: ep.id,
        episode_number: ep.episode_number,
        season_number: ep.season_number,
        name: ep.name,
        overview: ep.overview,
        still_path: ep.still_path,
        air_date: ep.air_date,
        runtime: ep.runtime,
        vote_average: ep.vote_average,
      }));
    }

    // Process credits
    if (data.credits) {
      data.cast = data.credits.cast?.slice(0, 10).map((c: any) => ({
        name: c.name,
        character: c.character,
        profile_url: c.profile_path ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}` : null,
      }));
      
      const director = data.credits.crew?.find((c: any) => c.job === 'Director');
      if (director) {
        data.director = director.name;
      }
    }

    // Process TV show creators
    if (data.created_by && data.created_by.length > 0) {
      data.creator = data.created_by[0].name;
    }

    // Process videos for trailer
    if (data.videos?.results) {
      const trailer = data.videos.results.find(
        (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
      );
      if (trailer) {
        data.trailer_url = `https://www.youtube.com/watch?v=${trailer.key}`;
        data.trailer_key = trailer.key;
      }
    }

    // Add metadata wrapper for compatibility with hooks
    if (action === 'search' && data.results?.length > 0) {
      data.metadata = data.results[0];
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TMDB] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
