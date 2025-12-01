
-- Populando retroativamente r2_storage_objects com VODs já existentes no R2
INSERT INTO r2_storage_objects (
  r2_key,
  r2_bucket,
  content_type,
  mime_type,
  size_bytes,
  source_channel_id,
  source_url,
  cdn_url,
  cache_control,
  status,
  access_count,
  bandwidth_bytes,
  created_at,
  updated_at
)
SELECT 
  'vod/' || mc.id || '/video.mp4' as r2_key,
  'iptv-vod' as r2_bucket,
  COALESCE(mc.content_type, 'video/mp4') as content_type,
  'video/mp4' as mime_type,
  COALESCE(
    (SELECT file_size_bytes FROM vod_downloads WHERE channel_id = mc.id AND status = 'completed' LIMIT 1),
    0
  ) as size_bytes,
  mc.id as source_channel_id,
  mc.stream_url as source_url,
  mc.r2_url as cdn_url,
  'public, max-age=31536000, immutable' as cache_control,
  'ready' as status,
  0 as access_count,
  0 as bandwidth_bytes,
  mc.r2_uploaded_at as created_at,
  mc.r2_uploaded_at as updated_at
FROM m3u_channels mc
WHERE mc.r2_uploaded = true
  AND mc.r2_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM r2_storage_objects 
    WHERE r2_key = 'vod/' || mc.id || '/video.mp4'
  )
ON CONFLICT (r2_key) DO NOTHING;

-- Verificar se a RPC get_cdn_stats existe, senão criar
CREATE OR REPLACE FUNCTION get_cdn_stats()
RETURNS TABLE(
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
    COUNT(*) as total_objects,
    ROUND((SUM(COALESCE(size_bytes, 0))::NUMERIC / 1073741824), 2) as total_size_gb,
    COUNT(*) FILTER (WHERE status = 'ready') as ready_objects,
    COUNT(*) FILTER (WHERE status IN ('pending', 'uploading')) as pending_objects,
    SUM(COALESCE(access_count, 0)) as total_access_count,
    ROUND((SUM(COALESCE(bandwidth_bytes, 0))::NUMERIC / 1073741824), 2) as total_bandwidth_gb,
    (
      SELECT COUNT(*) FROM cdn_prewarm_jobs 
      WHERE created_at >= CURRENT_DATE
    ) as prewarm_jobs_today,
    (
      SELECT COUNT(*) FROM cdn_signed_tokens 
      WHERE expires_at > NOW() AND revoked_at IS NULL
    ) as active_tokens
  FROM r2_storage_objects;
END;
$$;
