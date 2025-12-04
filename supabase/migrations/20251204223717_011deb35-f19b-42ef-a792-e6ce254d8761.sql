-- ==========================================
-- PLAYLIST MANAGEMENT SYSTEM TABLES
-- ==========================================

-- Main playlists table for metadata indexing
CREATE TABLE IF NOT EXISTS public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  original_source text,
  channel_count int DEFAULT 0,
  unique_count int DEFAULT 0,
  quarantined_count int DEFAULT 0,
  opts jsonb DEFAULT '{}'::jsonb,
  probe_summary jsonb DEFAULT '{}'::jsonb,
  sha256 text NOT NULL,
  size_bytes bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  archived boolean DEFAULT false,
  archived_at timestamptz,
  archive_id uuid,
  version int DEFAULT 1,
  CONSTRAINT unique_sha256_user UNIQUE (sha256, user_id)
);

-- Playlist archives table for monthly tar.gz bundles
CREATE TABLE IF NOT EXISTS public.playlist_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_path text NOT NULL,
  archive_month text NOT NULL, -- Format: YYYY-MM
  size_bytes bigint DEFAULT 0,
  sha256 text NOT NULL,
  playlist_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  verified boolean DEFAULT false,
  verified_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Playlist access logs for analytics
CREATE TABLE IF NOT EXISTS public.playlist_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id uuid,
  access_type text DEFAULT 'view', -- view, download, signed_url
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_playlists_sha256 ON public.playlists (sha256);
CREATE INDEX IF NOT EXISTS idx_playlists_user_created ON public.playlists (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_expires ON public.playlists (expires_at) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_playlists_archived ON public.playlists (archived, archived_at);
CREATE INDEX IF NOT EXISTS idx_playlists_storage_path ON public.playlists (storage_path);
CREATE INDEX IF NOT EXISTS idx_playlist_archives_month ON public.playlist_archives (archive_month);
CREATE INDEX IF NOT EXISTS idx_playlist_access_logs_playlist ON public.playlist_access_logs (playlist_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlists
CREATE POLICY "Admins full access playlists" ON public.playlists
  FOR ALL USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Users view own playlists" ON public.playlists
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users delete own playlists" ON public.playlists
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for archives (admin only)
CREATE POLICY "Admins full access playlist_archives" ON public.playlist_archives
  FOR ALL USING (is_admin_or_master(auth.uid()));

-- RLS Policies for access logs
CREATE POLICY "Admins view all access logs" ON public.playlist_access_logs
  FOR SELECT USING (is_admin_or_master(auth.uid()));

CREATE POLICY "System insert access logs" ON public.playlist_access_logs
  FOR INSERT WITH CHECK (true);

-- Function to cleanup expired playlists
CREATE OR REPLACE FUNCTION cleanup_expired_playlists(retention_days int DEFAULT 30)
RETURNS TABLE(deleted_count int, deleted_paths text[]) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_paths text[];
  count_deleted int;
BEGIN
  -- Get paths of expired playlists
  SELECT array_agg(storage_path) INTO expired_paths
  FROM playlists
  WHERE archived = false
    AND expires_at < now()
    AND expires_at IS NOT NULL;
  
  -- Delete expired records
  WITH deleted AS (
    DELETE FROM playlists
    WHERE archived = false
      AND expires_at < now()
      AND expires_at IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO count_deleted FROM deleted;
  
  RETURN QUERY SELECT count_deleted, COALESCE(expired_paths, ARRAY[]::text[]);
END;
$$;

-- Function to get playlists for archival (previous month)
CREATE OR REPLACE FUNCTION get_playlists_for_archival(target_month text)
RETURNS TABLE(
  id uuid,
  storage_path text,
  sha256 text,
  size_bytes bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.storage_path, p.sha256, p.size_bytes
  FROM playlists p
  WHERE archived = false
    AND to_char(created_at, 'YYYY-MM') = target_month
  ORDER BY created_at;
$$;

-- Function to mark playlists as archived
CREATE OR REPLACE FUNCTION mark_playlists_archived(
  playlist_ids uuid[],
  p_archive_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE playlists
  SET archived = true,
      archived_at = now(),
      archive_id = p_archive_id
  WHERE id = ANY(playlist_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Function to keep only N latest versions per user
CREATE OR REPLACE FUNCTION prune_old_versions(keep_versions int DEFAULT 3)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH ranked AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM playlists
    WHERE user_id IS NOT NULL AND archived = false
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > keep_versions
  )
  DELETE FROM playlists WHERE id IN (SELECT id FROM to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;