-- =============================================================================
-- Phase 3: Client-side Optimization - User Viewing History
-- =============================================================================

-- Create user viewing history table for predictive preloading
CREATE TABLE IF NOT EXISTS public.user_viewing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id INTEGER NOT NULL REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  category TEXT,
  watch_duration INTEGER DEFAULT 0, -- seconds
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_type TEXT,
  quality_played TEXT,
  buffer_events INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_viewing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own history" ON public.user_viewing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.user_viewing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.user_viewing_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all history" ON public.user_viewing_history
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_viewing_history_user_recent 
  ON public.user_viewing_history (user_id, watched_at DESC);

CREATE INDEX IF NOT EXISTS idx_viewing_history_channel 
  ON public.user_viewing_history (channel_id);

CREATE INDEX IF NOT EXISTS idx_viewing_history_category 
  ON public.user_viewing_history (category);

-- Function to record viewing
CREATE OR REPLACE FUNCTION public.record_viewing(
  p_user_id UUID,
  p_channel_id INTEGER,
  p_duration INTEGER DEFAULT 0,
  p_device_type TEXT DEFAULT NULL,
  p_quality TEXT DEFAULT NULL,
  p_buffer_events INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_id UUID;
BEGIN
  -- Get channel category
  SELECT category INTO v_category FROM iptv_channels WHERE id = p_channel_id;
  
  -- Insert viewing record
  INSERT INTO user_viewing_history (
    user_id, channel_id, category, watch_duration, 
    device_type, quality_played, buffer_events
  )
  VALUES (
    p_user_id, p_channel_id, v_category, p_duration,
    p_device_type, p_quality, p_buffer_events
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to get user's top channels
CREATE OR REPLACE FUNCTION public.get_user_top_channels(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  channel_id INTEGER,
  channel_name TEXT,
  category TEXT,
  view_count BIGINT,
  total_duration BIGINT,
  last_watched TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    h.channel_id,
    c.name as channel_name,
    h.category,
    COUNT(*) as view_count,
    SUM(h.watch_duration) as total_duration,
    MAX(h.watched_at) as last_watched
  FROM user_viewing_history h
  JOIN iptv_channels c ON c.id = h.channel_id
  WHERE h.user_id = p_user_id
    AND h.watched_at > NOW() - INTERVAL '30 days'
  GROUP BY h.channel_id, c.name, h.category
  ORDER BY view_count DESC, last_watched DESC
  LIMIT p_limit;
$$;

-- Cleanup old viewing history (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_viewing_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM user_viewing_history
  WHERE watched_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;