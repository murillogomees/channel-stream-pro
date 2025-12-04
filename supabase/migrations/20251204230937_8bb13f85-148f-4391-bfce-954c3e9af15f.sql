-- ============================================
-- Migration: Playlist Management System v2
-- ============================================

-- Create archives table if not exists
CREATE TABLE IF NOT EXISTS public.archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  month text NOT NULL, -- YYYY-MM
  size_bytes bigint,
  sha256 text,
  playlist_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Add missing columns to playlists if they don't exist
DO $$ 
BEGIN
  -- Add archive_id if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'playlists' AND column_name = 'archive_id') THEN
    ALTER TABLE public.playlists ADD COLUMN archive_id uuid REFERENCES public.archives(id);
  END IF;
  
  -- Add content_hash for deduplication
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'playlists' AND column_name = 'content_hash') THEN
    ALTER TABLE public.playlists ADD COLUMN content_hash text;
  END IF;
  
  -- Add source_domain for logging without full URLs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'playlists' AND column_name = 'source_domain') THEN
    ALTER TABLE public.playlists ADD COLUMN source_domain text;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_playlists_sha256 ON public.playlists (sha256);
CREATE INDEX IF NOT EXISTS idx_playlists_user_created ON public.playlists (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_expires ON public.playlists (expires_at) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_playlists_content_hash ON public.playlists (content_hash);
CREATE INDEX IF NOT EXISTS idx_archives_month ON public.archives (month);

-- Enable RLS on archives
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;

-- Archives policies (admin only)
DROP POLICY IF EXISTS "Admins can manage archives" ON public.archives;
CREATE POLICY "Admins can manage archives" ON public.archives
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- Function to find existing playlist by content hash
CREATE OR REPLACE FUNCTION public.find_playlist_by_hash(p_sha256 text)
RETURNS TABLE(id uuid, storage_path text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, storage_path, created_at
  FROM playlists
  WHERE sha256 = p_sha256
    AND archived = false
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Function to insert playlist record
CREATE OR REPLACE FUNCTION public.insert_playlist(
  p_filename text,
  p_storage_path text,
  p_user_id uuid,
  p_original_source text,
  p_source_domain text,
  p_channel_count int,
  p_unique_count int,
  p_quarantined_count int,
  p_opts jsonb,
  p_probe_summary jsonb,
  p_sha256 text,
  p_size_bytes bigint,
  p_retention_days int DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO playlists (
    filename, storage_path, user_id, original_source, source_domain,
    channel_count, unique_count, quarantined_count, opts, probe_summary,
    sha256, size_bytes, expires_at, archived
  ) VALUES (
    p_filename, p_storage_path, p_user_id, p_original_source, p_source_domain,
    p_channel_count, p_unique_count, p_quarantined_count, p_opts, p_probe_summary,
    p_sha256, p_size_bytes, now() + (p_retention_days || ' days')::interval, false
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to get playlist with signed URL info
CREATE OR REPLACE FUNCTION public.get_playlist_metadata(p_id uuid)
RETURNS TABLE(
  id uuid,
  filename text,
  storage_path text,
  user_id uuid,
  channel_count int,
  unique_count int,
  quarantined_count int,
  sha256 text,
  size_bytes bigint,
  created_at timestamptz,
  expires_at timestamptz,
  archived boolean,
  opts jsonb,
  probe_summary jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    p.id, p.filename, p.storage_path, p.user_id,
    p.channel_count, p.unique_count, p.quarantined_count,
    p.sha256, p.size_bytes, p.created_at, p.expires_at, p.archived,
    p.opts, p.probe_summary
  FROM playlists p
  WHERE p.id = p_id;
$$;

-- Function to list playlists with pagination
CREATE OR REPLACE FUNCTION public.list_playlists(
  p_user_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_include_archived boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  filename text,
  storage_path text,
  user_id uuid,
  channel_count int,
  sha256 text,
  size_bytes bigint,
  created_at timestamptz,
  expires_at timestamptz,
  archived boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    p.id, p.filename, p.storage_path, p.user_id,
    p.channel_count, p.sha256, p.size_bytes,
    p.created_at, p.expires_at, p.archived
  FROM playlists p
  WHERE (p_user_id IS NULL OR p.user_id = p_user_id)
    AND (p_from IS NULL OR p.created_at >= p_from)
    AND (p_to IS NULL OR p.created_at <= p_to)
    AND (p_include_archived OR p.archived = false)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Function to delete playlist (with ownership check)
CREATE OR REPLACE FUNCTION public.delete_playlist(p_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
  v_owner_id uuid;
BEGIN
  -- Check if user is admin
  SELECT is_admin_or_master(p_user_id) INTO v_is_admin;
  
  -- Get owner
  SELECT user_id INTO v_owner_id FROM playlists WHERE id = p_id;
  
  -- Check permissions
  IF NOT v_is_admin AND v_owner_id != p_user_id THEN
    RETURN false;
  END IF;
  
  -- Delete
  DELETE FROM playlists WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- Archive metrics view
CREATE OR REPLACE VIEW public.vw_playlist_metrics AS
SELECT
  COUNT(*) AS total_playlists,
  COUNT(*) FILTER (WHERE archived = false) AS active_playlists,
  COUNT(*) FILTER (WHERE archived = true) AS archived_playlists,
  SUM(size_bytes) AS total_size_bytes,
  SUM(channel_count) AS total_channels,
  AVG(channel_count)::int AS avg_channels_per_playlist,
  COUNT(DISTINCT user_id) AS unique_users
FROM playlists;