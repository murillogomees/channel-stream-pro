/**
 * IPTV Player - Type Definitions
 * Enterprise-grade type system for the player
 */

// =============================================================================
// CONTENT TYPES
// =============================================================================

export type ContentType = 'live' | 'movie' | 'series' | 'episode';

export interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  tvg_id?: string;
  tvg_name?: string;
  category_id?: string;
  category_name?: string;
  group_title?: string;
  order_position?: number;
  metadata?: Record<string, any>;
}

export interface Category {
  id: string;
  name: string;
  display_name: string;
  icon?: string;
  order_position: number;
  channels: Channel[];
}

export interface ContentItem {
  id: string;
  name: string;
  type: ContentType;
  logo?: string;
  backdrop?: string;
  category?: string;
  description?: string;
  year?: number;
  duration?: number;
  rating?: number;
  genres?: string[];
  metadata?: Record<string, any>;
}

// =============================================================================
// USER PROFILE TYPES
// =============================================================================

export type ProfileType = 'adult' | 'kids' | 'guest';

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url?: string;
  profile_type: ProfileType;
  pin_code?: string;
  is_default: boolean;
  preferences: ProfilePreferences;
  created_at: string;
  updated_at: string;
}

export interface ProfilePreferences {
  language: string;
  subtitle_size: 'small' | 'medium' | 'large';
  subtitle_color: string;
  subtitle_background: boolean;
  autoplay: boolean;
  skip_intro: boolean;
  playback_speed: number;
}

// =============================================================================
// WATCH PROGRESS TYPES
// =============================================================================

export interface WatchProgress {
  id: string;
  profile_id: string;
  content_id: string;
  content_type: ContentType;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  progress_seconds: number;
  duration_seconds: number;
  progress_percent: number;
  completed: boolean;
  metadata?: Record<string, any>;
  updated_at: string;
}

export interface WatchHistoryItem {
  id: string;
  profile_id: string;
  content_id: string;
  content_type: ContentType;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  watched_at: string;
  duration_seconds: number;
  metadata?: Record<string, any>;
}

// =============================================================================
// FAVORITES & WATCHLIST
// =============================================================================

export interface FavoriteItem {
  id: string;
  profile_id: string;
  content_id: string;
  content_type: ContentType;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WatchlistItem extends FavoriteItem {
  tmdb_id?: string;
  imdb_rating?: number;
}

// =============================================================================
// TRENDING & RECOMMENDATIONS
// =============================================================================

export type RankingType = 'daily' | 'weekly' | 'monthly';
export type RecommendationType = 'similar' | 'because_watched' | 'trending' | 'time_based' | 'genre_based';

export interface TrendingItem {
  id: string;
  content_id: string;
  content_type: ContentType;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  ranking_type: RankingType;
  rank_position: number;
  view_count: number;
  score: number;
  ranking_date: string;
}

export interface RecommendationItem {
  id: string;
  content_id: string;
  content_type: ContentType;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  reason?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface RecommendationGroup {
  type: RecommendationType;
  title: string;
  source_content?: string;
  items: RecommendationItem[];
}

// =============================================================================
// CONTENT METADATA (TMDB/IMDB)
// =============================================================================

export interface ContentMetadata {
  id: string;
  content_id: string;
  content_type: ContentType;
  title: string;
  original_title?: string;
  description?: string;
  poster_url?: string;
  backdrop_url?: string;
  trailer_url?: string;
  year?: number;
  duration_minutes?: number;
  genres?: string[];
  imdb_id?: string;
  imdb_rating?: number;
  tmdb_id?: string;
  tmdb_rating?: number;
  cast_members?: CastMember[];
  director?: string;
  country?: string;
  language?: string;
}

export interface CastMember {
  name: string;
  character?: string;
  profile_url?: string;
}

// =============================================================================
// EPG TYPES
// =============================================================================

export interface EPGProgram {
  id: string;
  channel_id: string;
  program_title: string;
  program_description?: string;
  start_time: string;
  end_time: string;
  category?: string;
  poster_url?: string;
  is_live: boolean;
  is_new: boolean;
  rating?: string;
}

// =============================================================================
// PLAYER STATE
// =============================================================================

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error' | 'ended';

export interface PlayerConfig {
  autoplay: boolean;
  muted: boolean;
  volume: number;
  playbackSpeed: number;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  subtitles: boolean;
  subtitleTrack?: number;
}

export interface PlayerMetrics {
  bitrate: number;
  bufferedSeconds: number;
  droppedFrames: number;
  latency: number;
  resolution: string;
  codec: string;
}

// =============================================================================
// SERIES TRACKING
// =============================================================================

export interface SeriesProgress {
  series_id: string;
  series_name: string;
  current_season: number;
  current_episode: number;
  total_seasons: number;
  episodes_watched: number;
  total_episodes: number;
  last_watched_at: string;
}

export interface EpisodeProgress {
  id: string;
  profile_id: string;
  series_id: string;
  series_name: string;
  season_number: number;
  episode_number: number;
  episode_name?: string;
  watched: boolean;
  watched_at?: string;
  progress_seconds: number;
  duration_seconds: number;
}

// =============================================================================
// ANALYTICS
// =============================================================================

export type AnalyticsEventType = 'play' | 'pause' | 'seek' | 'complete' | 'skip' | 'error';

export interface AnalyticsEvent {
  profile_id: string;
  content_id: string;
  content_type: ContentType;
  event_type: AnalyticsEventType;
  event_data?: Record<string, any>;
  session_id?: string;
  device_type?: string;
  watch_hour?: number;
  watch_day?: number;
}

// =============================================================================
// HOME SECTIONS
// =============================================================================

export interface HomeSection {
  id: string;
  type: 'continue_watching' | 'trending' | 'recommendations' | 'favorites' | 'category' | 'new_releases';
  title: string;
  subtitle?: string;
  items: ContentItem[];
  showViewAll?: boolean;
  layout?: 'row' | 'grid' | 'hero';
}
