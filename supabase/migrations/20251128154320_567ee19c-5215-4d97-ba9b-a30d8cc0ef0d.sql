-- ============================================================================
-- IPTV PLAYER ENTERPRISE - DATABASE SCHEMA
-- ============================================================================

-- User Profiles (multiple profiles per account)
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  profile_type TEXT NOT NULL DEFAULT 'adult' CHECK (profile_type IN ('adult', 'kids', 'guest')),
  pin_code TEXT, -- For parental control
  is_default BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{"language": "pt-BR", "subtitle_size": "medium", "autoplay": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Watch History (what user watched)
CREATE TABLE public.watch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL, -- channel/movie/series id
  content_type TEXT NOT NULL CHECK (content_type IN ('live', 'movie', 'series', 'episode')),
  content_name TEXT NOT NULL,
  content_logo TEXT,
  content_category TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- extra info like season, episode
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Watch Progress (for continue watching)
CREATE TABLE public.watch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series', 'episode')),
  content_name TEXT NOT NULL,
  content_logo TEXT,
  content_category TEXT,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  progress_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN duration_seconds > 0 
    THEN LEAST(100, (progress_seconds::NUMERIC / duration_seconds) * 100)
    ELSE 0 END
  ) STORED,
  completed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, content_id)
);

-- User Favorites
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('live', 'movie', 'series')),
  content_name TEXT NOT NULL,
  content_logo TEXT,
  content_category TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, content_id)
);

-- My List (watchlist)
CREATE TABLE public.user_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  content_name TEXT NOT NULL,
  content_logo TEXT,
  content_category TEXT,
  tmdb_id TEXT,
  imdb_rating NUMERIC(3,1),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, content_id)
);

-- Content Metadata Cache (TMDB/IMDB data)
CREATE TABLE public.content_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  title TEXT NOT NULL,
  original_title TEXT,
  description TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  trailer_url TEXT,
  year INTEGER,
  duration_minutes INTEGER,
  genres TEXT[],
  imdb_id TEXT,
  imdb_rating NUMERIC(3,1),
  tmdb_id TEXT,
  tmdb_rating NUMERIC(3,1),
  cast_members JSONB DEFAULT '[]'::jsonb,
  director TEXT,
  country TEXT,
  language TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trending Rankings (daily/weekly)
CREATE TABLE public.trending_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('live', 'movie', 'series')),
  content_name TEXT NOT NULL,
  content_logo TEXT,
  content_category TEXT,
  ranking_type TEXT NOT NULL CHECK (ranking_type IN ('daily', 'weekly', 'monthly')),
  rank_position INTEGER NOT NULL,
  view_count INTEGER DEFAULT 0,
  score NUMERIC(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  ranking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(content_id, ranking_type, ranking_date)
);

-- Recommendations Cache
CREATE TABLE public.recommendations_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('similar', 'because_watched', 'trending', 'time_based', 'genre_based')),
  source_content_id TEXT, -- For "because you watched X"
  recommended_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- EPG Data (Electronic Program Guide)
CREATE TABLE public.epg_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  program_title TEXT NOT NULL,
  program_description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT,
  poster_url TEXT,
  is_live BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  rating TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(channel_id, start_time)
);

-- Series Episodes Tracking
CREATE TABLE public.series_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL,
  series_name TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  episode_name TEXT,
  watched BOOLEAN DEFAULT false,
  watched_at TIMESTAMP WITH TIME ZONE,
  progress_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, series_id, season_number, episode_number)
);

-- Player Analytics (for recommendations AI)
CREATE TABLE public.player_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'seek', 'complete', 'skip', 'error')),
  event_data JSONB DEFAULT '{}'::jsonb,
  session_id UUID,
  device_type TEXT,
  watch_hour INTEGER, -- Hour of day (0-23) for time-based recommendations
  watch_day INTEGER, -- Day of week (0-6)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Channel Usage Stats (for smart sorting)
CREATE TABLE public.channel_usage_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  view_count INTEGER DEFAULT 1,
  total_watch_time_seconds INTEGER DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id, channel_id)
);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epg_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profiles" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profiles" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles" ON public.user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for watch_history (via profile)
CREATE POLICY "Users can view own watch history" ON public.watch_history
  FOR SELECT USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own watch history" ON public.watch_history
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for watch_progress
CREATE POLICY "Users can manage own watch progress" ON public.watch_progress
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for user_favorites
CREATE POLICY "Users can manage own favorites" ON public.user_favorites
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for user_watchlist
CREATE POLICY "Users can manage own watchlist" ON public.user_watchlist
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for content_metadata (public read)
CREATE POLICY "Anyone can read content metadata" ON public.content_metadata
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage content metadata" ON public.content_metadata
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for trending_rankings (public read)
CREATE POLICY "Anyone can read trending" ON public.trending_rankings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage trending" ON public.trending_rankings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for recommendations_cache
CREATE POLICY "Users can view own recommendations" ON public.recommendations_cache
  FOR SELECT USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "System can manage recommendations" ON public.recommendations_cache
  FOR ALL USING (true);

-- RLS Policies for epg_data (public read)
CREATE POLICY "Anyone can read EPG" ON public.epg_data
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage EPG" ON public.epg_data
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for series_episodes
CREATE POLICY "Users can manage own series episodes" ON public.series_episodes
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for player_analytics
CREATE POLICY "Users can insert own analytics" ON public.player_analytics
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all analytics" ON public.player_analytics
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for channel_usage_stats
CREATE POLICY "Users can manage own channel stats" ON public.channel_usage_stats
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- Create indexes for performance
CREATE INDEX idx_watch_history_profile ON public.watch_history(profile_id);
CREATE INDEX idx_watch_history_watched_at ON public.watch_history(watched_at DESC);
CREATE INDEX idx_watch_progress_profile ON public.watch_progress(profile_id);
CREATE INDEX idx_watch_progress_updated ON public.watch_progress(updated_at DESC);
CREATE INDEX idx_user_favorites_profile ON public.user_favorites(profile_id);
CREATE INDEX idx_trending_date_type ON public.trending_rankings(ranking_date, ranking_type);
CREATE INDEX idx_epg_channel_time ON public.epg_data(channel_id, start_time);
CREATE INDEX idx_channel_usage_profile ON public.channel_usage_stats(profile_id);
CREATE INDEX idx_player_analytics_profile ON public.player_analytics(profile_id);
CREATE INDEX idx_content_metadata_tmdb ON public.content_metadata(tmdb_id);

-- Function to auto-create default profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, name, is_default, profile_type)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), true, 'adult');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for auto-profile creation
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Function to update watch progress
CREATE OR REPLACE FUNCTION public.update_watch_progress(
  p_profile_id UUID,
  p_content_id TEXT,
  p_content_type TEXT,
  p_content_name TEXT,
  p_content_logo TEXT,
  p_content_category TEXT,
  p_progress_seconds INTEGER,
  p_duration_seconds INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.watch_progress AS $$
DECLARE
  result public.watch_progress;
BEGIN
  INSERT INTO public.watch_progress (
    profile_id, content_id, content_type, content_name, content_logo,
    content_category, progress_seconds, duration_seconds, metadata
  ) VALUES (
    p_profile_id, p_content_id, p_content_type, p_content_name, p_content_logo,
    p_content_category, p_progress_seconds, p_duration_seconds, p_metadata
  )
  ON CONFLICT (profile_id, content_id) DO UPDATE SET
    progress_seconds = EXCLUDED.progress_seconds,
    duration_seconds = EXCLUDED.duration_seconds,
    completed = EXCLUDED.progress_seconds >= (EXCLUDED.duration_seconds * 0.95),
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get continue watching
CREATE OR REPLACE FUNCTION public.get_continue_watching(p_profile_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  content_id TEXT,
  content_type TEXT,
  content_name TEXT,
  content_logo TEXT,
  content_category TEXT,
  progress_seconds INTEGER,
  duration_seconds INTEGER,
  progress_percent NUMERIC,
  metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wp.content_id,
    wp.content_type,
    wp.content_name,
    wp.content_logo,
    wp.content_category,
    wp.progress_seconds,
    wp.duration_seconds,
    wp.progress_percent,
    wp.metadata,
    wp.updated_at
  FROM public.watch_progress wp
  WHERE wp.profile_id = p_profile_id
    AND wp.completed = false
    AND wp.progress_percent > 5
    AND wp.progress_percent < 95
  ORDER BY wp.updated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update channel usage stats
CREATE OR REPLACE FUNCTION public.record_channel_view(
  p_profile_id UUID,
  p_channel_id TEXT,
  p_watch_seconds INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.channel_usage_stats (profile_id, channel_id, view_count, total_watch_time_seconds, last_watched_at)
  VALUES (p_profile_id, p_channel_id, 1, p_watch_seconds, now())
  ON CONFLICT (profile_id, channel_id) DO UPDATE SET
    view_count = channel_usage_stats.view_count + 1,
    total_watch_time_seconds = channel_usage_stats.total_watch_time_seconds + p_watch_seconds,
    last_watched_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;