-- Reset stuck downloads older than 30 minutes
UPDATE vod_downloads 
SET status = 'failed', 
    error_message = 'Timeout - resetado automaticamente'
WHERE status IN ('queued', 'downloading', 'processing')
  AND download_started_at < NOW() - INTERVAL '30 minutes';