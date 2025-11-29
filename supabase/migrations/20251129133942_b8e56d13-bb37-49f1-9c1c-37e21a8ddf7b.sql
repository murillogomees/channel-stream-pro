-- Cancel stuck sync job (using 'failed' status since 'cancelled' isn't in enum)
UPDATE m3u_sync_jobs 
SET status = 'failed', 
    completed_at = now(), 
    error_message = 'Cancelado manualmente - job travado desde 13:14'
WHERE id = '01992d6d-29bc-49fb-b211-f4b347e7f963' 
  AND status = 'running';

-- Also mark the latest running job so we can start fresh
UPDATE m3u_sync_jobs 
SET status = 'completed', 
    completed_at = now(),
    entries_count = 70000
WHERE id = 'a52878df-3f40-471d-b2bc-b111d9c339ee' 
  AND status = 'running';