-- Remove duplicate M3U channels keeping the first occurrence
WITH duplicates AS (
  SELECT id, stream_url,
    ROW_NUMBER() OVER (PARTITION BY stream_url ORDER BY created_at ASC) as rn
  FROM m3u_channels
  WHERE stream_url IS NOT NULL AND stream_url != ''
)
DELETE FROM m3u_channels 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates (optional - commented for safety)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_m3u_channels_unique_url ON m3u_channels(stream_url) WHERE stream_url IS NOT NULL AND stream_url != '';

-- Create cleanup function for scheduled maintenance
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(
  activity_deleted INTEGER,
  sessions_deleted INTEGER,
  notifications_deleted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity INTEGER := 0;
  v_sessions INTEGER := 0;
  v_notifications INTEGER := 0;
BEGIN
  -- Cleanup activity_logs
  DELETE FROM activity_logs 
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_activity = ROW_COUNT;
  
  -- Cleanup auth_sessions_log
  DELETE FROM auth_sessions_log 
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  
  -- Cleanup notification_logs
  DELETE FROM notification_logs 
  WHERE sent_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS v_notifications = ROW_COUNT;
  
  RETURN QUERY SELECT v_activity, v_sessions, v_notifications;
END;
$$;