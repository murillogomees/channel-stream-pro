-- Reset stuck r2_download_jobs
UPDATE r2_download_jobs 
SET status = 'queued', 
    error_message = NULL, 
    started_at = NULL,
    retry_count = 0
WHERE status = 'validating' 
  AND updated_at < NOW() - INTERVAL '5 minutes';

-- Reset stuck vod_downloads
UPDATE vod_downloads 
SET status = 'queued',
    error_message = 'Reset: job was stuck',
    retry_count = COALESCE(retry_count, 0) + 1
WHERE status IN ('downloading', 'processing', 'paused')
  AND updated_at < NOW() - INTERVAL '5 minutes';