-- Resetar downloads que travaram em 100%
UPDATE vod_downloads 
SET status = 'failed', 
    error_message = 'Reiniciado automaticamente - download travou em 100%'
WHERE status = 'downloading' 
  AND segments_downloaded >= segment_count 
  AND segment_count > 0
  AND download_started_at < NOW() - INTERVAL '5 minutes';