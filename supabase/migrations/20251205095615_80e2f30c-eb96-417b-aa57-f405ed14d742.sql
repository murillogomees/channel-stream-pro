-- Sync completed vod_downloads to r2_storage_objects
INSERT INTO r2_storage_objects (
  source_channel_id,
  r2_bucket,
  r2_key,
  cdn_url,
  size_bytes,
  mime_type,
  content_type,
  status,
  cache_control,
  created_at
)
SELECT 
  vd.channel_id,
  'iptvlink-cdn',
  'vod/' || vd.channel_id || '/video.mp4',
  vd.r2_url,
  vd.file_size_bytes,
  'video/mp4',
  'vod',
  'ready',
  'public, max-age=31536000, immutable',
  vd.created_at
FROM vod_downloads vd
WHERE vd.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM r2_storage_objects r2 
    WHERE r2.source_channel_id = vd.channel_id
  );