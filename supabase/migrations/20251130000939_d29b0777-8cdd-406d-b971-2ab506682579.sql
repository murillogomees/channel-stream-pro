-- Drop existing function to change return type
DROP FUNCTION IF EXISTS public.get_cf_stream_statistics();

-- Create function with extended statistics for dashboard
CREATE OR REPLACE FUNCTION public.get_cf_stream_statistics()
RETURNS TABLE (
  total_vods bigint,
  vods_on_stream bigint,
  vods_pending bigint,
  uploads_queued bigint,
  uploads_processing bigint,
  uploads_ready bigint,
  uploads_error bigint,
  uploads_retry_scheduled bigint,
  uploads_uploading bigint,
  total_duration_hours numeric,
  estimated_monthly_cost numeric,
  avg_retry_count numeric,
  success_rate numeric,
  uploads_last_24h bigint,
  errors_last_24h bigint,
  max_retry_reached bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_vods bigint;
  v_vods_on_stream bigint;
  v_total_duration_seconds bigint;
BEGIN
  -- Count total VODs in channels
  SELECT COUNT(*) INTO v_total_vods
  FROM m3u_channels
  WHERE is_vod = true;

  -- Count VODs with CF Stream URL
  SELECT COUNT(*) INTO v_vods_on_stream
  FROM m3u_channels
  WHERE cf_stream_url IS NOT NULL AND cf_stream_status = 'ready';

  -- Total duration
  SELECT COALESCE(SUM(cf_stream_duration_seconds), 0) INTO v_total_duration_seconds
  FROM m3u_channels
  WHERE cf_stream_duration_seconds IS NOT NULL;

  RETURN QUERY
  SELECT
    v_total_vods,
    v_vods_on_stream,
    (v_total_vods - v_vods_on_stream)::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'queued')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'processing')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'ready')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'error')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'retry_scheduled')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'uploading')::bigint,
    ROUND(v_total_duration_seconds::numeric / 3600, 2),
    ROUND((v_total_duration_seconds::numeric / 3600) * 0.005, 2),
    ROUND((SELECT AVG(retry_count) FROM cf_stream_uploads WHERE retry_count > 0), 2),
    ROUND(
      (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'ready')::numeric * 100 / 
      NULLIF((SELECT COUNT(*) FROM cf_stream_uploads WHERE status IN ('ready', 'error')), 0),
      1
    ),
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE created_at > NOW() - INTERVAL '24 hours')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'error' AND updated_at > NOW() - INTERVAL '24 hours')::bigint,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE retry_count >= 5 AND status = 'error')::bigint;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cf_stream_uploads_retry_scheduled 
ON cf_stream_uploads(status, retry_count) 
WHERE status = 'retry_scheduled';

CREATE INDEX IF NOT EXISTS idx_cf_stream_uploads_errors 
ON cf_stream_uploads(status, updated_at) 
WHERE status = 'error';