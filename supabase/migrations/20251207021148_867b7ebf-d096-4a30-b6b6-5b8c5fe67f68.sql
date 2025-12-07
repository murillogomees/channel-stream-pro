-- =====================================================
-- R2 MIGRATION INFRASTRUCTURE - High Performance Schema
-- =====================================================

-- Add R2 sync columns to m3u_sync_entries
ALTER TABLE m3u_sync_entries
  ADD COLUMN IF NOT EXISTS r2_path text,
  ADD COLUMN IF NOT EXISTS r2_etag text,
  ADD COLUMN IF NOT EXISTS is_synced boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS migrated_at timestamptz;

-- Add R2 sync columns to m3u_channels  
ALTER TABLE m3u_channels
  ADD COLUMN IF NOT EXISTS r2_logo_path text,
  ADD COLUMN IF NOT EXISTS r2_logo_etag text,
  ADD COLUMN IF NOT EXISTS is_logo_synced boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_migrated_at timestamptz;

-- Add R2 sync columns to playlist_entries
ALTER TABLE playlist_entries
  ADD COLUMN IF NOT EXISTS r2_output_path text,
  ADD COLUMN IF NOT EXISTS r2_output_etag text,
  ADD COLUMN IF NOT EXISTS is_output_synced boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS output_migrated_at timestamptz;

-- Migration jobs tracking table
CREATE TABLE IF NOT EXISTS r2_migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL DEFAULT 'full', -- full, incremental, retry
  target_table text NOT NULL,
  batch_size integer DEFAULT 100,
  concurrency integer DEFAULT 8,
  status text DEFAULT 'pending', -- pending, running, paused, completed, failed
  total_items integer DEFAULT 0,
  processed_items integer DEFAULT 0,
  success_items integer DEFAULT 0,
  failed_items integer DEFAULT 0,
  skipped_items integer DEFAULT 0,
  avg_duration_ms numeric DEFAULT 0,
  throughput_per_min numeric DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  paused_at timestamptz,
  last_checkpoint jsonb,
  config jsonb DEFAULT '{}',
  error_summary jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Migration logs for audit trail
CREATE TABLE IF NOT EXISTS r2_migration_logs (
  id bigserial PRIMARY KEY,
  job_id uuid REFERENCES r2_migration_jobs(id) ON DELETE CASCADE,
  item_table text NOT NULL,
  item_id text NOT NULL,
  from_url text,
  to_path text,
  etag_old text,
  etag_new text,
  size_bytes bigint,
  duration_ms integer,
  status text NOT NULL, -- success, failed, skipped
  error text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Failed items queue for retry
CREATE TABLE IF NOT EXISTS r2_migration_failed (
  id bigserial PRIMARY KEY,
  job_id uuid REFERENCES r2_migration_jobs(id) ON DELETE CASCADE,
  item_table text NOT NULL,
  item_id text NOT NULL,
  source_url text,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  next_retry_at timestamptz,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Feature flags for migration control
CREATE TABLE IF NOT EXISTS r2_migration_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Insert default config values
INSERT INTO r2_migration_config (key, value, description) VALUES
  ('USE_R2_STORAGE', 'false', 'Enable R2 storage for reads'),
  ('MIGRATION_ENABLED', 'false', 'Enable migration worker'),
  ('BATCH_SIZE', '100', 'Items per batch'),
  ('CONCURRENCY', '8', 'Concurrent uploads per worker'),
  ('MAX_RETRIES', '3', 'Max retry attempts'),
  ('OPS_BUDGET_MONTHLY', '1000000', 'Monthly R2 operations budget'),
  ('THROTTLE_ENABLED', 'false', 'Enable cost throttling'),
  ('IMAGE_COMPRESSION', '{"enabled": true, "quality": 75, "format": "webp"}', 'Image optimization config'),
  ('CACHE_CONTROL_VERSIONED', '"public, max-age=31536000, immutable"', 'Cache headers for versioned assets'),
  ('CACHE_CONTROL_PLAYLIST', '"public, max-age=60, stale-while-revalidate=300"', 'Cache headers for playlists')
ON CONFLICT (key) DO NOTHING;

-- Metrics snapshots for monitoring
CREATE TABLE IF NOT EXISTS r2_migration_metrics (
  id bigserial PRIMARY KEY,
  timestamp timestamptz DEFAULT now(),
  job_id uuid REFERENCES r2_migration_jobs(id),
  items_processed integer DEFAULT 0,
  items_success integer DEFAULT 0,
  items_failed integer DEFAULT 0,
  bytes_uploaded bigint DEFAULT 0,
  ops_count integer DEFAULT 0,
  avg_latency_ms numeric DEFAULT 0,
  cache_hit_rate numeric DEFAULT 0,
  egress_bytes bigint DEFAULT 0
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_is_synced ON m3u_sync_entries(is_synced) WHERE is_synced = false;
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_r2_path ON m3u_sync_entries(r2_path) WHERE r2_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_m3u_channels_is_logo_synced ON m3u_channels(is_logo_synced) WHERE is_logo_synced = false;
CREATE INDEX IF NOT EXISTS idx_playlist_entries_is_output_synced ON playlist_entries(is_output_synced) WHERE is_output_synced = false;
CREATE INDEX IF NOT EXISTS idx_r2_migration_logs_job_id ON r2_migration_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_r2_migration_logs_status ON r2_migration_logs(status);
CREATE INDEX IF NOT EXISTS idx_r2_migration_failed_next_retry ON r2_migration_failed(next_retry_at) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_r2_migration_jobs_status ON r2_migration_jobs(status);

-- Enable RLS
ALTER TABLE r2_migration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_migration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_migration_failed ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_migration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_migration_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin/Master only
CREATE POLICY "Admin access r2_migration_jobs" ON r2_migration_jobs
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin access r2_migration_logs" ON r2_migration_logs
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin access r2_migration_failed" ON r2_migration_failed
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin access r2_migration_config" ON r2_migration_config
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin access r2_migration_metrics" ON r2_migration_metrics
  FOR ALL USING (is_admin_or_master(auth.uid()));

-- Helper function to get migration stats
CREATE OR REPLACE FUNCTION get_r2_migration_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'playlist_entries', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM playlist_entries),
      'synced', (SELECT COUNT(*) FROM playlist_entries WHERE is_output_synced = true),
      'pending', (SELECT COUNT(*) FROM playlist_entries WHERE is_output_synced = false OR is_output_synced IS NULL)
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

-- Function to get config value
CREATE OR REPLACE FUNCTION get_r2_config(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT value FROM r2_migration_config WHERE key = p_key;
$$;

-- Function to set config value
CREATE OR REPLACE FUNCTION set_r2_config(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO r2_migration_config (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now(),
    updated_by = auth.uid();
END;
$$;