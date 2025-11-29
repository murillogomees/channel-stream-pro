-- ============================================================================
-- Stream Analytics - Netflix-Grade Performance Tracking
-- ============================================================================

-- Table for tracking streaming performance metrics
CREATE TABLE IF NOT EXISTS public.stream_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  channel_id TEXT,
  
  -- Performance metrics
  route_type TEXT, -- 'vod-r2', 'vod-proxy', 'live-proxy', 'direct'
  response_time_ms INTEGER,
  content_size_bytes BIGINT,
  cache_status TEXT, -- 'hit', 'miss', 'bypass'
  
  -- Playback quality metrics
  buffer_events INTEGER DEFAULT 0,
  rebuffer_duration_ms INTEGER DEFAULT 0,
  avg_bitrate_kbps INTEGER,
  quality_changes INTEGER DEFAULT 0,
  startup_time_ms INTEGER,
  
  -- Session info
  session_id TEXT,
  device_type TEXT, -- 'tv', 'mobile', 'desktop', 'webview'
  player_version TEXT,
  
  -- Network info
  connection_type TEXT, -- 'wifi', '4g', '5g', 'ethernet'
  estimated_bandwidth_kbps INTEGER,
  
  -- Error tracking
  error_code TEXT,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_stream_analytics_user_id ON public.stream_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_channel_id ON public.stream_analytics(channel_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_created_at ON public.stream_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_route_type ON public.stream_analytics(route_type);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_cache_status ON public.stream_analytics(cache_status);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_device_type ON public.stream_analytics(device_type);

-- Composite index for performance dashboards
CREATE INDEX IF NOT EXISTS idx_stream_analytics_performance 
ON public.stream_analytics(created_at DESC, route_type, cache_status);

-- Enable RLS
ALTER TABLE public.stream_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all stream analytics"
ON public.stream_analytics FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own stream analytics"
ON public.stream_analytics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert stream analytics"
ON public.stream_analytics FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- Aggregated metrics view for dashboards
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_stream_performance AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  route_type,
  cache_status,
  device_type,
  COUNT(*) as total_requests,
  AVG(response_time_ms) as avg_response_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time_ms,
  AVG(startup_time_ms) as avg_startup_time_ms,
  SUM(buffer_events) as total_buffer_events,
  AVG(avg_bitrate_kbps) as avg_bitrate_kbps,
  SUM(content_size_bytes) as total_bytes_served,
  COUNT(*) FILTER (WHERE error_code IS NOT NULL) as error_count
FROM public.stream_analytics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), route_type, cache_status, device_type
ORDER BY hour DESC;

-- ============================================================================
-- Function to get streaming performance summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_stream_performance_summary(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  total_streams BIGINT,
  avg_response_time_ms NUMERIC,
  p95_response_time_ms NUMERIC,
  cache_hit_rate NUMERIC,
  avg_startup_time_ms NUMERIC,
  total_buffer_events BIGINT,
  error_rate NUMERIC,
  total_gb_served NUMERIC,
  by_route_type JSONB,
  by_device_type JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) as total,
      AVG(sa.response_time_ms) as avg_rt,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY sa.response_time_ms) as p95_rt,
      COUNT(*) FILTER (WHERE sa.cache_status = 'hit')::NUMERIC / NULLIF(COUNT(*), 0) * 100 as cache_hit,
      AVG(sa.startup_time_ms) as avg_startup,
      SUM(COALESCE(sa.buffer_events, 0)) as buffers,
      COUNT(*) FILTER (WHERE sa.error_code IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0) * 100 as err_rate,
      SUM(COALESCE(sa.content_size_bytes, 0))::NUMERIC / 1073741824 as gb_served
    FROM public.stream_analytics sa
    WHERE sa.created_at > NOW() - (p_hours || ' hours')::INTERVAL
  ),
  by_route AS (
    SELECT jsonb_object_agg(
      COALESCE(sa.route_type, 'unknown'), 
      COUNT(*)
    ) as data
    FROM public.stream_analytics sa
    WHERE sa.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY true
  ),
  by_device AS (
    SELECT jsonb_object_agg(
      COALESCE(sa.device_type, 'unknown'), 
      COUNT(*)
    ) as data
    FROM public.stream_analytics sa
    WHERE sa.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY true
  )
  SELECT 
    s.total::BIGINT,
    ROUND(s.avg_rt, 2),
    ROUND(s.p95_rt::NUMERIC, 2),
    ROUND(s.cache_hit, 2),
    ROUND(s.avg_startup, 2),
    s.buffers::BIGINT,
    ROUND(s.err_rate, 2),
    ROUND(s.gb_served, 3),
    COALESCE(r.data, '{}'::JSONB),
    COALESCE(d.data, '{}'::JSONB)
  FROM stats s
  CROSS JOIN by_route r
  CROSS JOIN by_device d;
END;
$$;

-- ============================================================================
-- Cleanup function for old analytics data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_stream_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep detailed data for 30 days
  DELETE FROM public.stream_analytics
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_stream_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_stream_analytics TO service_role;
