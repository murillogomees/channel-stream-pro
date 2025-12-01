-- Fix get_cdn_stats function with proper type casts

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_objects,
    ROUND((COALESCE(SUM(size_bytes), 0)::NUMERIC / 1073741824), 2) as total_size_gb,
    COUNT(*) FILTER (WHERE status = 'ready')::BIGINT as ready_objects,
    COUNT(*) FILTER (WHERE status IN ('pending', 'uploading'))::BIGINT as pending_objects,
    COALESCE(SUM(access_count), 0)::BIGINT as total_access_count,
    ROUND((COALESCE(SUM(bandwidth_bytes), 0)::NUMERIC / 1073741824), 2) as total_bandwidth_gb,
    (
      SELECT COUNT(*)::BIGINT 
      FROM cdn_prewarm_jobs 
      WHERE DATE(created_at) = CURRENT_DATE
    ) as prewarm_jobs_today,
    (
      SELECT COUNT(*)::BIGINT
      FROM cdn_signed_tokens
      WHERE revoked_at IS NULL 
        AND expires_at > NOW()
    ) as active_tokens
  FROM r2_storage_objects;
END;
$$;