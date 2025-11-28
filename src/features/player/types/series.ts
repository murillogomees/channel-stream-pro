/**
 * Series-specific type definitions
 */

export interface Season {
  season_number: number;
  name: string;
  episode_count: number;
  air_date?: string;
  overview?: string;
  poster_url?: string;
}

export interface Episode {
  id: string;
  episode_number: number;
  season_number: number;
  name: string;
  overview?: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

export interface SeriesMetadata {
  id: string;
  content_id: string;
  tmdb_id?: string;
  imdb_id?: string;
  title: string;
  original_title?: string;
  description?: string;
  poster_url?: string;
  backdrop_url?: string;
  year?: number;
  status?: string; // "Returning Series", "Ended", etc.
  genres?: string[];
  tmdb_rating?: number;
  vote_count?: number;
  total_seasons?: number;
  total_episodes?: number;
  seasons?: Season[];
  cast_members?: Array<{
    name: string;
    character?: string;
    profile_url?: string;
  }>;
  creator?: string;
  networks?: string[];
  country?: string;
  language?: string;
}

export interface SeriesWatchProgress {
  series_id: string;
  series_name: string;
  series_poster?: string;
  current_season: number;
  current_episode: number;
  total_seasons: number;
  episodes_watched: number;
  total_episodes: number;
  progress_percent: number;
  last_watched_at: string;
  next_episode?: {
    season: number;
    episode: number;
    name?: string;
    stream_url?: string;
  };
}
