-- =============================================================================
-- Phase 4: Database Optimization - Materialized Views & Partitioning
-- =============================================================================

-- 1. Materialized View for Hot Channels (most accessed in last 24h)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_hot_channels AS
SELECT 
  c.id,
  c.name,
  c.category,
  c.logo_url,
  c.original_url,
  c.is_healthy,
  c.health_score,
  COUNT(h.id) as view_count_24h,
  COUNT(DISTINCT h.user_id) as unique_viewers_24h,
  AVG(h.watch_duration) as avg_duration
FROM public.iptv_channels c
LEFT JOIN public.user_viewing_history h ON h.channel_id = c.id 
  AND h.watched_at > NOW() - INTERVAL '24 hours'
WHERE c.is_healthy = true
GROUP BY c.id, c.name, c.category, c.logo_url, c.original_url, c.is_healthy, c.health_score
ORDER BY view_count_24h DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hot_channels_id ON public.mv_hot_channels (id);
CREATE INDEX IF NOT EXISTS idx_mv_hot_channels_category ON public.mv_hot_channels (category);
CREATE INDEX IF NOT EXISTS idx_mv_hot_channels_views ON public.mv_hot_channels (view_count_24h DESC);

-- 2. Materialized View for Channel Health Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_channel_health_summary AS
SELECT 
  category,
  COUNT(*) as total_channels,
  COUNT(*) FILTER (WHERE is_healthy = true) as healthy_channels,
  COUNT(*) FILTER (WHERE is_healthy = false) as unhealthy_channels,
  AVG(health_score) as avg_health_score,
  COUNT(*) FILTER (WHERE health_score >= 90) as excellent_count,
  COUNT(*) FILTER (WHERE health_score >= 70 AND health_score < 90) as good_count,
  COUNT(*) FILTER (WHERE health_score < 70) as poor_count
FROM public.iptv_channels
GROUP BY category;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_channel_health_category ON public.mv_channel_health_summary (category);

-- 3. Materialized View for User Activity Summary (aggregated metrics)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_activity_summary AS
SELECT 
  DATE_TRUNC('hour', watched_at) as hour_bucket,
  COUNT(*) as total_views,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT channel_id) as unique_channels,
  AVG(watch_duration) as avg_duration,
  SUM(buffer_events) as total_buffer_events
FROM public.user_viewing_history
WHERE watched_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', watched_at)
ORDER BY hour_bucket DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_hour ON public.mv_user_activity_summary (hour_bucket);

-- 4. Function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_hot_data_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hot_channels;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_health_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
  
  RAISE NOTICE 'Materialized views refreshed at %', NOW();
END;
$$;

-- 5. Performance metrics table with time-series optimization
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id BIGSERIAL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  tags JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create partitions for current and next month
CREATE TABLE IF NOT EXISTS public.performance_metrics_current PARTITION OF public.performance_metrics
  FOR VALUES FROM (DATE_TRUNC('month', NOW())) TO (DATE_TRUNC('month', NOW()) + INTERVAL '1 month');

CREATE TABLE IF NOT EXISTS public.performance_metrics_next PARTITION OF public.performance_metrics
  FOR VALUES FROM (DATE_TRUNC('month', NOW()) + INTERVAL '1 month') TO (DATE_TRUNC('month', NOW()) + INTERVAL '2 months');

-- Indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_perf_metrics_type_time ON public.performance_metrics_current (metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_name_time ON public.performance_metrics_current (metric_name, recorded_at DESC);

-- 6. Function to record performance metric
CREATE OR REPLACE FUNCTION public.record_metric(
  p_type TEXT,
  p_name TEXT,
  p_value NUMERIC,
  p_tags JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO performance_metrics (metric_type, metric_name, metric_value, tags)
  VALUES (p_type, p_name, p_value, p_tags);
END;
$$;

-- 7. Function to get aggregated metrics
CREATE OR REPLACE FUNCTION public.get_metrics_summary(
  p_type TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  metric_type TEXT,
  metric_name TEXT,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pm.metric_type,
    pm.metric_name,
    AVG(pm.metric_value) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    COUNT(*) as count
  FROM performance_metrics pm
  WHERE pm.recorded_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND (p_type IS NULL OR pm.metric_type = p_type)
  GROUP BY pm.metric_type, pm.metric_name
  ORDER BY pm.metric_type, pm.metric_name;
$$;

-- 8. Auto-partition creation function
CREATE OR REPLACE FUNCTION public.create_next_partition()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := DATE_TRUNC('month', NOW()) + INTERVAL '2 months';
  v_end_date := v_start_date + INTERVAL '1 month';
  v_partition_name := 'performance_metrics_' || TO_CHAR(v_start_date, 'YYYY_MM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = v_partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.performance_metrics FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_start_date, v_end_date
    );
    RAISE NOTICE 'Created partition: %', v_partition_name;
  END IF;
END;
$$;

-- Grant access to materialized views
GRANT SELECT ON public.mv_hot_channels TO authenticated;
GRANT SELECT ON public.mv_channel_health_summary TO authenticated;
GRANT SELECT ON public.mv_user_activity_summary TO authenticated;