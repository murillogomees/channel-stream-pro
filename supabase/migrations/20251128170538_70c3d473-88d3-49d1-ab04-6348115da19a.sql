-- ================================================
-- M3U Sync System - Database Schema
-- ================================================

-- Enum for sync status
CREATE TYPE public.m3u_sync_status AS ENUM ('pending', 'running', 'completed', 'failed', 'partial');

-- Table: M3U Sync Sources - URLs to sync from
CREATE TABLE public.m3u_sync_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, -- slug identifier (e.g., 'main-playlist')
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 30,
  last_sync_at TIMESTAMPTZ,
  last_sync_status public.m3u_sync_status DEFAULT 'pending',
  last_error TEXT,
  entries_count INTEGER DEFAULT 0,
  invalid_entries_count INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  checksum TEXT, -- MD5 hash for change detection
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Table: M3U Sync Jobs - History of sync operations
CREATE TABLE public.m3u_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.m3u_sync_sources(id) ON DELETE CASCADE,
  status public.m3u_sync_status DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  entries_count INTEGER DEFAULT 0,
  invalid_entries_count INTEGER DEFAULT 0,
  new_entries INTEGER DEFAULT 0,
  updated_entries INTEGER DEFAULT 0,
  removed_entries INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  triggered_by TEXT DEFAULT 'manual' -- 'manual', 'cron', 'api'
);

-- Table: M3U Sync Entries - Parsed entries index for search
CREATE TABLE public.m3u_sync_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.m3u_sync_sources(id) ON DELETE CASCADE,
  entry_hash TEXT NOT NULL, -- hash of url+title for dedup
  title TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  group_title TEXT,
  tvg_id TEXT,
  tvg_name TEXT,
  tvg_logo TEXT,
  tvg_language TEXT,
  duration INTEGER DEFAULT -1,
  is_valid BOOLEAN DEFAULT true,
  raw_extinf TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, entry_hash)
);

-- Table: M3U Sync Files - Track generated files
CREATE TABLE public.m3u_sync_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.m3u_sync_sources(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('m3u', 'm3u_gz', 'json')),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  content_type TEXT,
  checksum TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Table: M3U Sync Errors - Store recent errors for debugging
CREATE TABLE public.m3u_sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.m3u_sync_sources(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.m3u_sync_jobs(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_m3u_sync_sources_key ON public.m3u_sync_sources(key);
CREATE INDEX idx_m3u_sync_sources_enabled ON public.m3u_sync_sources(enabled);
CREATE INDEX idx_m3u_sync_jobs_source ON public.m3u_sync_jobs(source_id);
CREATE INDEX idx_m3u_sync_jobs_status ON public.m3u_sync_jobs(status);
CREATE INDEX idx_m3u_sync_jobs_started ON public.m3u_sync_jobs(started_at DESC);
CREATE INDEX idx_m3u_sync_entries_source ON public.m3u_sync_entries(source_id);
CREATE INDEX idx_m3u_sync_entries_hash ON public.m3u_sync_entries(entry_hash);
CREATE INDEX idx_m3u_sync_entries_title ON public.m3u_sync_entries USING gin(to_tsvector('portuguese', title));
CREATE INDEX idx_m3u_sync_entries_group ON public.m3u_sync_entries(group_title);
CREATE INDEX idx_m3u_sync_files_source ON public.m3u_sync_files(source_id);
CREATE INDEX idx_m3u_sync_errors_source ON public.m3u_sync_errors(source_id);

-- Trigger for updated_at
CREATE TRIGGER update_m3u_sync_sources_updated_at
  BEFORE UPDATE ON public.m3u_sync_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m3u_sync_entries_updated_at
  BEFORE UPDATE ON public.m3u_sync_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.m3u_sync_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_sync_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_sync_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_sync_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only for write, read for authenticated
CREATE POLICY "Admins can manage sync sources"
  ON public.m3u_sync_sources FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view sync sources"
  ON public.m3u_sync_sources FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sync jobs"
  ON public.m3u_sync_jobs FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view sync jobs"
  ON public.m3u_sync_jobs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sync entries"
  ON public.m3u_sync_entries FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view sync entries"
  ON public.m3u_sync_entries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sync files"
  ON public.m3u_sync_files FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view sync files"
  ON public.m3u_sync_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sync errors"
  ON public.m3u_sync_errors FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view sync errors"
  ON public.m3u_sync_errors FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to get sync statistics
CREATE OR REPLACE FUNCTION public.get_m3u_sync_stats()
RETURNS TABLE(
  total_sources BIGINT,
  active_sources BIGINT,
  total_entries BIGINT,
  last_sync TIMESTAMPTZ,
  failed_syncs_24h BIGINT,
  successful_syncs_24h BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM m3u_sync_sources)::BIGINT,
    (SELECT COUNT(*) FROM m3u_sync_sources WHERE enabled = true)::BIGINT,
    (SELECT COUNT(*) FROM m3u_sync_entries WHERE is_valid = true)::BIGINT,
    (SELECT MAX(last_sync_at) FROM m3u_sync_sources),
    (SELECT COUNT(*) FROM m3u_sync_jobs WHERE status = 'failed' AND started_at > now() - interval '24 hours')::BIGINT,
    (SELECT COUNT(*) FROM m3u_sync_jobs WHERE status = 'completed' AND started_at > now() - interval '24 hours')::BIGINT;
$$;

-- Function for full-text search
CREATE OR REPLACE FUNCTION public.search_m3u_entries(
  search_query TEXT,
  source_key TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  stream_url TEXT,
  group_title TEXT,
  tvg_logo TEXT,
  source_name TEXT,
  score REAL
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id,
    e.title,
    e.stream_url,
    e.group_title,
    e.tvg_logo,
    s.name as source_name,
    ts_rank(to_tsvector('portuguese', e.title), plainto_tsquery('portuguese', search_query)) as score
  FROM m3u_sync_entries e
  JOIN m3u_sync_sources s ON e.source_id = s.id
  WHERE e.is_valid = true
    AND (source_key IS NULL OR s.key = source_key)
    AND (
      to_tsvector('portuguese', e.title) @@ plainto_tsquery('portuguese', search_query)
      OR e.title ILIKE '%' || search_query || '%'
      OR e.group_title ILIKE '%' || search_query || '%'
    )
  ORDER BY score DESC, e.title
  LIMIT limit_count;
$$;

-- Function to cleanup old jobs and errors
CREATE OR REPLACE FUNCTION public.cleanup_old_m3u_sync_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep only last 100 jobs per source
  DELETE FROM m3u_sync_jobs
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY started_at DESC) as rn
      FROM m3u_sync_jobs
    ) ranked
    WHERE rn > 100
  );
  
  -- Keep only last 30 days of errors
  DELETE FROM m3u_sync_errors
  WHERE created_at < now() - interval '30 days';
END;
$$;