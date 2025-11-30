-- Reset failed uploads to retry with improved scheduler logic
-- This migration resets uploads that failed with "unknown cause" error

UPDATE cf_stream_uploads 
SET 
  status = 'retry_scheduled',
  retry_count = 1,
  error_message = 'Reset for retry with improved scheduler',
  cf_stream_uid = NULL,
  started_at = NULL,
  metadata = jsonb_build_object(
    'reset_at', now()::text,
    'previous_error', error_message,
    'next_retry', (now() + interval '2 minutes')::text
  )
WHERE status = 'error' 
  AND (error_message LIKE '%unknown cause%' OR error_message LIKE '%encoding failed%');

-- Also update the corresponding channels
UPDATE m3u_channels 
SET cf_stream_status = 'pending'
WHERE cf_stream_status = 'error'
  AND id IN (
    SELECT channel_id FROM cf_stream_uploads 
    WHERE status = 'retry_scheduled'
  );