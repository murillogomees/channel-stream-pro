-- ============================================
-- R2 CDN STORAGE & PREWARM SYSTEM
-- Sprint 6: Consolidated CDN Infrastructure
-- ============================================

-- Storage naming convention: r2/iptvlink/{env}/{content_type}/{id}
-- Content types: vod, live, manifest, segment, thumbnail

-- R2 Storage Objects tracking
CREATE TABLE public.r2_storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- R2 path following convention
  r2_key TEXT NOT NULL UNIQUE, -- r2/iptvlink/prod/vod/abc123
  r2_bucket TEXT NOT NULL DEFAULT 'iptvlink-cdn',
  
  -- Content info
  content_type TEXT NOT NULL CHECK (content_type IN ('vod', 'live', 'manifest', 'segment', 'thumbnail', 'other')),
  mime_type TEXT,
  size_bytes BIGINT,
  checksum_md5 TEXT,
  
  -- Source tracking
  source_channel_id UUID REFERENCES m3u_channels(id) ON DELETE SET NULL,
  source_url TEXT,
  
  -- CDN metadata
  cdn_url TEXT, -- Public CDN URL
  cache_control TEXT DEFAULT 'public, max-age=86400',
  content_encoding TEXT, -- brotli, gzip, etc
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'ready', 'failed', 'deleted')),
  error_message TEXT,
  
  -- Analytics
  access_count BIGINT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  bandwidth_bytes BIGINT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- CDN signed tokens for manifest access
CREATE TABLE public.cdn_signed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Token info
  token_hash TEXT NOT NULL UNIQUE, -- SHA256 of the JWT
  token_type TEXT NOT NULL DEFAULT 'manifest' CHECK (token_type IN ('manifest', 'segment', 'download')),
  
  -- Target
  r2_key TEXT NOT NULL,
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Security
  ip_restriction TEXT, -- Optional IP binding
  referrer_restriction TEXT, -- Optional referrer check
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  
  -- Validity
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- CDN edge cache prewarm jobs
CREATE TABLE public.cdn_prewarm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job info
  job_type TEXT NOT NULL DEFAULT 'nightly' CHECK (job_type IN ('nightly', 'on_demand', 'prediction_based')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Target assets
  target_r2_keys TEXT[] NOT NULL DEFAULT '{}',
  segments_per_asset INTEGER DEFAULT 5, -- First N segments to prewarm
  
  -- Progress
  total_assets INTEGER DEFAULT 0,
  prewarmed_assets INTEGER DEFAULT 0,
  failed_assets INTEGER DEFAULT 0,
  
  -- Timing
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  total_bytes_prewarmed BIGINT DEFAULT 0,
  avg_prewarm_time_ms INTEGER,
  error_log JSONB DEFAULT '[]',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CDN prewarm predictions (ML fallback: moving average views)
CREATE TABLE public.cdn_prewarm_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content reference
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  r2_key TEXT,
  
  -- Prediction scores
  predicted_views INTEGER DEFAULT 0,
  moving_avg_views NUMERIC(10,2) DEFAULT 0,
  ml_score NUMERIC(5,4), -- Optional ML prediction 0-1
  priority_rank INTEGER,
  
  -- Historical data
  views_7d INTEGER DEFAULT 0,
  views_30d INTEGER DEFAULT 0,
  peak_hour INTEGER, -- Hour of day with most views
  
  -- Validity
  calculated_at TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ DEFAULT now() + INTERVAL '24 hours',
  
  CONSTRAINT unique_channel_prediction UNIQUE (channel_id)
);

-- CDN rate limiting tracking
CREATE TABLE public.cdn_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifier
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user', 'token', 'referrer')),
  identifier_value TEXT NOT NULL,
  
  -- Limits
  request_count INTEGER DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT now(),
  window_duration_seconds INTEGER DEFAULT 60,
  
  -- Status
  blocked_until TIMESTAMPTZ,
  block_reason TEXT,
  
  -- Config
  max_requests_per_window INTEGER DEFAULT 100,
  max_bandwidth_per_window BIGINT DEFAULT 104857600, -- 100MB default
  
  CONSTRAINT unique_rate_limit UNIQUE (identifier_type, identifier_value, window_start)
);

-- Indexes
CREATE INDEX idx_r2_storage_channel ON r2_storage_objects(source_channel_id);
CREATE INDEX idx_r2_storage_status ON r2_storage_objects(status);
CREATE INDEX idx_r2_storage_content_type ON r2_storage_objects(content_type);
CREATE INDEX idx_r2_storage_access ON r2_storage_objects(access_count DESC);

CREATE INDEX idx_cdn_tokens_expires ON cdn_signed_tokens(expires_at);
CREATE INDEX idx_cdn_tokens_channel ON cdn_signed_tokens(channel_id);
CREATE INDEX idx_cdn_tokens_hash ON cdn_signed_tokens(token_hash);

CREATE INDEX idx_prewarm_jobs_status ON cdn_prewarm_jobs(status);
CREATE INDEX idx_prewarm_jobs_scheduled ON cdn_prewarm_jobs(scheduled_at);

CREATE INDEX idx_prewarm_predictions_rank ON cdn_prewarm_predictions(priority_rank);
CREATE INDEX idx_prewarm_predictions_valid ON cdn_prewarm_predictions(valid_until);

CREATE INDEX idx_rate_limits_lookup ON cdn_rate_limits(identifier_type, identifier_value);
CREATE INDEX idx_rate_limits_blocked ON cdn_rate_limits(blocked_until);

-- Enable RLS
ALTER TABLE r2_storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdn_signed_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdn_prewarm_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdn_prewarm_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdn_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only for management tables)
CREATE POLICY "Admins can manage R2 objects"
  ON r2_storage_objects FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage CDN tokens"
  ON cdn_signed_tokens FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own tokens"
  ON cdn_signed_tokens FOR SELECT
  USING (user_profile_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage prewarm jobs"
  ON cdn_prewarm_jobs FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage predictions"
  ON cdn_prewarm_predictions FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage rate limits"
  ON cdn_rate_limits FOR ALL
  USING (public.is_admin(auth.uid()));

-- Function to generate R2 key following naming convention
CREATE OR REPLACE FUNCTION generate_r2_key(
  p_env TEXT,
  p_content_type TEXT,
  p_id TEXT,
  p_extension TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'iptvlink/' || p_env || '/' || p_content_type || '/' || p_id || 
         COALESCE('.' || p_extension, '');
END;
$$;

-- Function to calculate prewarm predictions
CREATE OR REPLACE FUNCTION calculate_prewarm_predictions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Clear old predictions
  DELETE FROM cdn_prewarm_predictions WHERE valid_until < now();
  
  -- Calculate predictions based on view statistics
  INSERT INTO cdn_prewarm_predictions (
    channel_id,
    r2_key,
    predicted_views,
    moving_avg_views,
    views_7d,
    views_30d,
    priority_rank
  )
  SELECT 
    mc.id,
    r2.r2_key,
    COALESCE(
      -- Simple prediction: 7-day average * 1.1 for trending boost
      ROUND(COALESCE(SUM(cus.view_count), 0) / 7.0 * 1.1),
      0
    )::INTEGER as predicted_views,
    ROUND(COALESCE(SUM(cus.view_count), 0) / 7.0, 2) as moving_avg,
    COALESCE(SUM(cus.view_count) FILTER (WHERE cus.last_watched_at > now() - interval '7 days'), 0)::INTEGER,
    COALESCE(SUM(cus.view_count), 0)::INTEGER,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(cus.view_count), 0) DESC)
  FROM m3u_channels mc
  LEFT JOIN channel_usage_stats cus ON mc.id::text = cus.channel_id
  LEFT JOIN r2_storage_objects r2 ON r2.source_channel_id = mc.id AND r2.status = 'ready'
  WHERE mc.is_vod = true OR mc.content_type = 'vod'
  GROUP BY mc.id, r2.r2_key
  ON CONFLICT (channel_id) DO UPDATE SET
    predicted_views = EXCLUDED.predicted_views,
    moving_avg_views = EXCLUDED.moving_avg_views,
    views_7d = EXCLUDED.views_7d,
    views_30d = EXCLUDED.views_30d,
    priority_rank = EXCLUDED.priority_rank,
    calculated_at = now(),
    valid_until = now() + interval '24 hours';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_cdn_rate_limit(
  p_type TEXT,
  p_value TEXT,
  p_request_size BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record cdn_rate_limits%ROWTYPE;
  v_window_start TIMESTAMPTZ;
  v_allowed BOOLEAN := true;
  v_reason TEXT;
BEGIN
  v_window_start := date_trunc('minute', now());
  
  -- Check for existing block
  SELECT * INTO v_record
  FROM cdn_rate_limits
  WHERE identifier_type = p_type
    AND identifier_value = p_value
    AND (blocked_until IS NULL OR blocked_until > now())
  ORDER BY window_start DESC
  LIMIT 1;
  
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', v_record.block_reason,
      'blocked_until', v_record.blocked_until,
      'retry_after', EXTRACT(EPOCH FROM (v_record.blocked_until - now()))::INTEGER
    );
  END IF;
  
  -- Upsert rate limit tracking
  INSERT INTO cdn_rate_limits (
    identifier_type, identifier_value, 
    request_count, bandwidth_bytes, window_start
  ) VALUES (
    p_type, p_value, 1, p_request_size, v_window_start
  )
  ON CONFLICT (identifier_type, identifier_value, window_start) DO UPDATE SET
    request_count = cdn_rate_limits.request_count + 1,
    bandwidth_bytes = cdn_rate_limits.bandwidth_bytes + p_request_size
  RETURNING * INTO v_record;
  
  -- Check limits
  IF v_record.request_count > v_record.max_requests_per_window THEN
    v_allowed := false;
    v_reason := 'Rate limit exceeded: too many requests';
  ELSIF v_record.bandwidth_bytes > v_record.max_bandwidth_per_window THEN
    v_allowed := false;
    v_reason := 'Bandwidth limit exceeded';
  END IF;
  
  -- Block if limit exceeded
  IF NOT v_allowed THEN
    UPDATE cdn_rate_limits
    SET blocked_until = now() + interval '5 minutes',
        block_reason = v_reason
    WHERE id = v_record.id;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'requests', v_record.request_count,
    'bandwidth', v_record.bandwidth_bytes,
    'remaining_requests', v_record.max_requests_per_window - v_record.request_count,
    'remaining_bandwidth', v_record.max_bandwidth_per_window - v_record.bandwidth_bytes
  );
END;
$$;

-- Function to get CDN stats
CREATE OR REPLACE FUNCTION get_cdn_stats()
RETURNS TABLE (
  total_objects BIGINT,
  total_size_gb NUMERIC,
  ready_objects BIGINT,
  pending_objects BIGINT,
  total_access_count BIGINT,
  total_bandwidth_gb NUMERIC,
  prewarm_jobs_today BIGINT,
  active_tokens BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM r2_storage_objects),
    (SELECT ROUND(COALESCE(SUM(size_bytes), 0) / 1073741824.0, 2) FROM r2_storage_objects),
    (SELECT COUNT(*) FROM r2_storage_objects WHERE status = 'ready'),
    (SELECT COUNT(*) FROM r2_storage_objects WHERE status = 'pending'),
    (SELECT COALESCE(SUM(access_count), 0) FROM r2_storage_objects),
    (SELECT ROUND(COALESCE(SUM(bandwidth_bytes), 0) / 1073741824.0, 2) FROM r2_storage_objects),
    (SELECT COUNT(*) FROM cdn_prewarm_jobs WHERE DATE(created_at) = CURRENT_DATE),
    (SELECT COUNT(*) FROM cdn_signed_tokens WHERE expires_at > now() AND revoked_at IS NULL);
$$;

-- Cleanup old rate limits and expired tokens
CREATE OR REPLACE FUNCTION cleanup_cdn_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete old rate limit records (older than 1 hour)
  DELETE FROM cdn_rate_limits
  WHERE window_start < now() - interval '1 hour';
  
  -- Delete expired tokens (older than 24 hours past expiry)
  DELETE FROM cdn_signed_tokens
  WHERE expires_at < now() - interval '24 hours';
  
  -- Delete old prewarm jobs (older than 30 days)
  DELETE FROM cdn_prewarm_jobs
  WHERE created_at < now() - interval '30 days';
END;
$$;