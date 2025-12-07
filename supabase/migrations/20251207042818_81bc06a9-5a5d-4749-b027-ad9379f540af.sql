-- Update the get_r2_migration_stats function to remove playlist_entries reference
CREATE OR REPLACE FUNCTION public.get_r2_migration_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
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
      'running', (SELECT COUNT(*) FROM r2_migration_jobs WHERE status = 'running'),
      'completed', (SELECT COUNT(*) FROM r2_migration_jobs WHERE status = 'completed'),
      'failed', (SELECT COUNT(*) FROM r2_migration_jobs WHERE status = 'failed')
    ),
    'failed_items', (SELECT COUNT(*) FROM r2_migration_failed WHERE resolved = false),
    'last_updated', now()
  ) INTO result;
  
  RETURN result;
END;
$$;