-- =====================================================
-- IPTV Scalable Architecture - Phase 1
-- Schema for 209k+ channels with sharding support
-- =====================================================

-- 1. Channels table (main entity)
CREATE TABLE public.iptv_channels (
  id BIGSERIAL PRIMARY KEY,
  shard_id INT NOT NULL DEFAULT 0,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  original_url TEXT NOT NULL,
  logo_url TEXT,
  category TEXT,
  content_type TEXT DEFAULT 'live', -- live, vod, series
  codec_hint TEXT, -- h264, h265, etc
  resolution TEXT, -- 1080p, 720p, etc
  bitrate_estimate INT,
  fallback_channel_id BIGINT REFERENCES public.iptv_channels(id),
  is_healthy BOOLEAN DEFAULT true,
  health_score INT DEFAULT 100, -- 0-100
  last_probe_at TIMESTAMPTZ,
  probe_error TEXT,
  transcode_status TEXT DEFAULT 'none', -- none, queued, processing, ready
  transcode_manifest_url TEXT,
  priority INT DEFAULT 0, -- higher = more important
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Playlists table
CREATE TABLE public.iptv_playlists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  channel_count INT DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Playlist-Channel junction (supports ordering)
CREATE TABLE public.iptv_playlist_channels (
  playlist_id BIGINT REFERENCES public.iptv_playlists(id) ON DELETE CASCADE,
  channel_id BIGINT REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  custom_name TEXT,
  custom_logo TEXT,
  is_hidden BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (playlist_id, channel_id)
);

-- 4. Playback tokens (short-lived auth for streams)
CREATE TABLE public.iptv_stream_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id BIGINT REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Probe jobs queue (for tracking)
CREATE TABLE public.iptv_probe_jobs (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Transcode jobs queue
CREATE TABLE public.iptv_transcode_jobs (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  mode TEXT DEFAULT 'abr', -- abr, single, passthrough
  target_resolutions TEXT[] DEFAULT ARRAY['1080p', '720p', '480p', '360p'],
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  progress INT DEFAULT 0,
  output_urls JSONB,
  error_message TEXT,
  worker_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Channel health metrics (time-series)
CREATE TABLE public.iptv_channel_metrics (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- probe_latency, stream_bitrate, error_rate
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CDN cache status
CREATE TABLE public.iptv_cdn_cache (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  cdn_provider TEXT DEFAULT 'r2', -- r2, cloudflare, custom
  cache_key TEXT NOT NULL,
  manifest_url TEXT,
  segment_prefix TEXT,
  is_warm BOOLEAN DEFAULT false,
  last_access_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES for 209k+ channels performance
-- =====================================================

-- Channels indexes
CREATE INDEX idx_iptv_channels_shard ON public.iptv_channels(shard_id);
CREATE INDEX idx_iptv_channels_healthy ON public.iptv_channels(is_healthy) WHERE is_healthy = true;
CREATE INDEX idx_iptv_channels_category ON public.iptv_channels(category);
CREATE INDEX idx_iptv_channels_priority ON public.iptv_channels(priority DESC);
CREATE INDEX idx_iptv_channels_transcode ON public.iptv_channels(transcode_status);
CREATE INDEX idx_iptv_channels_slug ON public.iptv_channels(slug);

-- Playlist channels indexes
CREATE INDEX idx_iptv_playlist_channels_position ON public.iptv_playlist_channels(playlist_id, position);

-- Stream tokens indexes
CREATE INDEX idx_iptv_stream_tokens_expires ON public.iptv_stream_tokens(expires_at);
CREATE INDEX idx_iptv_stream_tokens_user ON public.iptv_stream_tokens(user_id);
CREATE INDEX idx_iptv_stream_tokens_token ON public.iptv_stream_tokens(token);

-- Metrics indexes (time-series optimized)
CREATE INDEX idx_iptv_channel_metrics_time ON public.iptv_channel_metrics(channel_id, recorded_at DESC);

-- =====================================================
-- Enable RLS
-- =====================================================

ALTER TABLE public.iptv_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_playlist_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_stream_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_probe_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_transcode_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_channel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_cdn_cache ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Channels: public read, admin write
CREATE POLICY "Anyone can view healthy channels"
  ON public.iptv_channels FOR SELECT
  USING (is_healthy = true);

CREATE POLICY "Admins can manage channels"
  ON public.iptv_channels FOR ALL
  USING (is_admin_or_master());

-- Playlists: owner or public
CREATE POLICY "Users can view own playlists"
  ON public.iptv_playlists FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Users can manage own playlists"
  ON public.iptv_playlists FOR ALL
  USING (user_id = auth.uid() OR is_admin_or_master());

-- Playlist channels
CREATE POLICY "Users can view playlist channels"
  ON public.iptv_playlist_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.iptv_playlists p 
      WHERE p.id = playlist_id 
      AND (p.user_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY "Users can manage own playlist channels"
  ON public.iptv_playlist_channels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.iptv_playlists p 
      WHERE p.id = playlist_id 
      AND (p.user_id = auth.uid() OR is_admin_or_master())
    )
  );

-- Stream tokens: own tokens only
CREATE POLICY "Users can view own tokens"
  ON public.iptv_stream_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tokens"
  ON public.iptv_stream_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all tokens"
  ON public.iptv_stream_tokens FOR ALL
  USING (is_admin_or_master());

-- Jobs: admin only
CREATE POLICY "Admins can manage probe jobs"
  ON public.iptv_probe_jobs FOR ALL
  USING (is_admin_or_master());

CREATE POLICY "Admins can manage transcode jobs"
  ON public.iptv_transcode_jobs FOR ALL
  USING (is_admin_or_master());

-- Metrics: admin read
CREATE POLICY "Admins can view metrics"
  ON public.iptv_channel_metrics FOR SELECT
  USING (is_admin_or_master());

CREATE POLICY "System can insert metrics"
  ON public.iptv_channel_metrics FOR INSERT
  WITH CHECK (true);

-- CDN cache: admin only
CREATE POLICY "Admins can manage cdn cache"
  ON public.iptv_cdn_cache FOR ALL
  USING (is_admin_or_master());

-- =====================================================
-- Helper functions
-- =====================================================

-- Function to get channel shard
CREATE OR REPLACE FUNCTION public.get_channel_shard(channel_id BIGINT)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT shard_id FROM public.iptv_channels WHERE id = channel_id;
$$;

-- Function to update channel health
CREATE OR REPLACE FUNCTION public.update_channel_health(
  p_channel_id BIGINT,
  p_is_healthy BOOLEAN,
  p_health_score INT DEFAULT NULL,
  p_probe_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.iptv_channels
  SET 
    is_healthy = p_is_healthy,
    health_score = COALESCE(p_health_score, health_score),
    probe_error = p_probe_error,
    last_probe_at = now(),
    updated_at = now()
  WHERE id = p_channel_id;
END;
$$;

-- Function to generate stream token
CREATE OR REPLACE FUNCTION public.generate_stream_token(
  p_user_id UUID,
  p_channel_id BIGINT,
  p_ttl_seconds INT DEFAULT 3600
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO public.iptv_stream_tokens (user_id, channel_id, token, expires_at)
  VALUES (p_user_id, p_channel_id, v_token, now() + (p_ttl_seconds || ' seconds')::INTERVAL);
  
  RETURN v_token;
END;
$$;

-- Function to validate stream token
CREATE OR REPLACE FUNCTION public.validate_stream_token(p_token TEXT)
RETURNS TABLE(channel_id BIGINT, user_id UUID, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.channel_id,
    t.user_id,
    (t.expires_at > now() AND t.used_at IS NULL) as is_valid
  FROM public.iptv_stream_tokens t
  WHERE t.token = p_token;
  
  -- Mark as used
  UPDATE public.iptv_stream_tokens
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_iptv_channels_updated_at
  BEFORE UPDATE ON public.iptv_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_iptv_playlists_updated_at
  BEFORE UPDATE ON public.iptv_playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();