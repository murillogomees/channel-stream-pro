-- Reset downloads travados para que sejam reprocessados
UPDATE vod_downloads 
SET status = 'failed', error_message = 'Reset manual - reprocessar'
WHERE status IN ('downloading', 'queued') 
AND updated_at < NOW() - INTERVAL '5 minutes';