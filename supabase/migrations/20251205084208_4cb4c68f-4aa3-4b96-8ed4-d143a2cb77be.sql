-- Fix r2_storage_objects entries that are marked as ready but files don't exist
-- Mark them as pending so they can be re-downloaded

UPDATE r2_storage_objects 
SET status = 'pending', 
    error_message = 'Reset - file needs to be downloaded'
WHERE r2_key LIKE 'vod/%' 
AND status = 'ready';