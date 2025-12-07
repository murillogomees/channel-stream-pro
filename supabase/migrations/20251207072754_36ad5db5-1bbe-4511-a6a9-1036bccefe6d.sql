-- Update the get_r2_migration_stats function to detect stale jobs
-- A job is considered stale if it's "running" but hasn't been updated in 5+ minutes
CREATE OR REPLACE FUNCTION public.get_r2_migration_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  active_running_count integer;
  stale_running_count integer;
BEGIN
  -- Count truly active running jobs (updated in last 5 minutes)
  SELECT COUNT(*) INTO active_running_count 
  FROM r2_migration_jobs 
  WHERE status = 'running' 
    AND (
      updated_at > now() - interval '5 minutes'
      OR started_at > now() - interval '5 minutes'
    );
  
  -- Count stale running jobs (no updates in 5+ minutes)
  SELECT COUNT(*) INTO stale_running_count 
  FROM r2_migration_jobs 
  WHERE status = 'running' 
    AND updated_at < now() - interval '5 minutes'
    AND started_at < now() - interval '5 minutes';
  
  SELECT jsonb_build_object(
    'sync_entries', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM m3u_sync_entries),
      'synced', (SELECT COUNT(*) FROM m3u_sync_entries WHERE is_synced = true),
      'pending', (SELECT COUNT(*) FROM m3u_sync_entries WHERE is_synced = false OR is_synced IS NULL)
    ),
    'channels', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM m3u_channels),
      'synced', (SELECT COUNT(*) FROM m3u_channels WHERE is_logo_synced = true),
      'pending', (SELECT COUNT(*) FROM m3u_channels WHERE is_logo_synced = false OR is_logo_synced IS NULL)
    ),
    'jobs', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM r2_migration_jobs),
      'running', active_running_count,
      'stale', stale_running_count,
      'completed', (SELECT COUNT(*) FROM r2_migration_jobs WHERE status = 'completed'),
      'failed', (SELECT COUNT(*) FROM r2_migration_jobs WHERE status = 'failed')
    ),
    'failed_items', (SELECT COUNT(*) FROM r2_migration_failed WHERE resolved = false),
    'last_updated', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Auto-fix stale jobs: mark them as 'paused' so they can be resumed
-- This is a helper function that can be called periodically
CREATE OR REPLACE FUNCTION public.fix_stale_migration_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed_count integer;
BEGIN
  WITH stale_jobs AS (
    UPDATE r2_migration_jobs
    SET 
      status = 'paused',
      error_summary = jsonb_build_object(
        'reason', 'auto_paused_stale',
        'detected_at', now(),
        'last_activity', updated_at
      ),
      updated_at = now()
    WHERE status = 'running' 
      AND updated_at < now() - interval '5 minutes'
      AND started_at < now() - interval '5 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO fixed_count FROM stale_jobs;
  
  RETURN fixed_count;
END;
$$;