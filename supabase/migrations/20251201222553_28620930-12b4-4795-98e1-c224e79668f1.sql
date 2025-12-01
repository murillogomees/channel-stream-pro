-- Fix CDN Infrastructure: URLs, Stats, and Access Tracking

-- 1. Fix malformed cdn_urls (remove duplicate https://)
UPDATE r2_storage_objects
SET cdn_url = REPLACE(cdn_url, 'https://https//', 'https://')
WHERE cdn_url LIKE '%https://https//%';

-- 2. Create/update get_cdn_stats function
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_objects,
    ROUND(COALESCE(SUM(size_bytes), 0)::NUMERIC / (1024^3), 2) as total_size_gb,
    COUNT(*) FILTER (WHERE status = 'ready')::BIGINT as ready_objects,
    COUNT(*) FILTER (WHERE status IN ('pending', 'uploading'))::BIGINT as pending_objects,
    COALESCE(SUM(access_count), 0)::BIGINT as total_access_count,
    ROUND(COALESCE(SUM(bandwidth_bytes), 0)::NUMERIC / (1024^3), 2) as total_bandwidth_gb,
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

-- 3. Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_r2_storage_objects_r2_key 
  ON r2_storage_objects(r2_key);

CREATE INDEX IF NOT EXISTS idx_r2_storage_objects_status 
  ON r2_storage_objects(status);

CREATE INDEX IF NOT EXISTS idx_cdn_signed_tokens_expires 
  ON cdn_signed_tokens(expires_at) 
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cdn_prewarm_jobs_created 
  ON cdn_prewarm_jobs(created_at DESC);

-- 4. Add missing default values
ALTER TABLE r2_storage_objects 
  ALTER COLUMN access_count SET DEFAULT 0,
  ALTER COLUMN bandwidth_bytes SET DEFAULT 0;

ALTER TABLE cdn_signed_tokens
  ALTER COLUMN current_uses SET DEFAULT 0;

-- 5. Update existing NULL values
UPDATE r2_storage_objects 
SET access_count = 0 
WHERE access_count IS NULL;

UPDATE r2_storage_objects 
SET bandwidth_bytes = 0 
WHERE bandwidth_bytes IS NULL;

UPDATE cdn_signed_tokens
SET current_uses = 0
WHERE current_uses IS NULL;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_cdn_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_cdn_stats TO anon;