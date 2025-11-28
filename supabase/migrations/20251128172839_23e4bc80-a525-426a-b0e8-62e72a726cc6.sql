-- ============================================================================
-- M3U Playlist Sync Pipeline - Database Schema
-- ============================================================================

-- Main playlists registry table
CREATE TABLE IF NOT EXISTS public.playlist_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, -- slug identifier (e.g., "main", "premium", "sports")
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  
  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 60,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending', -- pending, syncing, success, failed
  last_sync_error TEXT,
  last_sync_duration_ms INTEGER,
  
  -- Content metadata
  entries_count INTEGER DEFAULT 0,
  invalid_count INTEGER DEFAULT 0,
  trimmed_count INTEGER DEFAULT 0,
  categories_count INTEGER DEFAULT 0,
  
  -- Cache control
  etag TEXT,
  content_hash TEXT,
  version INTEGER DEFAULT 1,
  
  -- Storage paths
  storage_path_m3u TEXT,
  storage_path_gz TEXT,
  storage_path_json TEXT,
  file_size_bytes BIGINT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Sync jobs/history table
CREATE TABLE IF NOT EXISTS public.playlist_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_key TEXT NOT NULL REFERENCES playlist_sources(key) ON DELETE CASCADE,
  
  -- Job status
  status TEXT DEFAULT 'queued', -- queued, running, completed, failed, cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Results
  entries_parsed INTEGER,
  entries_invalid INTEGER,
  entries_deduplicated INTEGER,
  parse_warnings JSONB DEFAULT '[]',
  
  -- Error tracking
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  triggered_by TEXT DEFAULT 'manual', -- manual, cron, api
  force_sync BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parsed entries cache (for search/indexing)
CREATE TABLE IF NOT EXISTS public.playlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_key TEXT NOT NULL REFERENCES playlist_sources(key) ON DELETE CASCADE,
  
  -- Entry data
  entry_hash TEXT NOT NULL, -- sha1(url + title)
  title TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  group_title TEXT,
  tvg_id TEXT,
  tvg_name TEXT,
  tvg_logo TEXT,
  tvg_language TEXT,
  duration INTEGER DEFAULT -1,
  sequence INTEGER,
  
  -- Validation
  is_valid BOOLEAN DEFAULT true,
  validation_error TEXT,
  
  -- Search optimization
  search_vector TSVECTOR,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(playlist_key, entry_hash)
);

-- Sync locks table (prevent concurrent syncs)
CREATE TABLE IF NOT EXISTS public.playlist_sync_locks (
  playlist_key TEXT PRIMARY KEY REFERENCES playlist_sources(key) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ DEFAULT now(),
  locked_by TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_playlist_sources_key ON playlist_sources(key);
CREATE INDEX IF NOT EXISTS idx_playlist_sources_sync_enabled ON playlist_sources(sync_enabled) WHERE sync_enabled = true;
CREATE INDEX IF NOT EXISTS idx_playlist_sync_jobs_key_status ON playlist_sync_jobs(playlist_key, status);
CREATE INDEX IF NOT EXISTS idx_playlist_sync_jobs_created ON playlist_sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_entries_key ON playlist_entries(playlist_key);
CREATE INDEX IF NOT EXISTS idx_playlist_entries_group ON playlist_entries(playlist_key, group_title);
CREATE INDEX IF NOT EXISTS idx_playlist_entries_search ON playlist_entries USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_playlist_entry_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', 
    COALESCE(NEW.title, '') || ' ' || 
    COALESCE(NEW.group_title, '') || ' ' ||
    COALESCE(NEW.tvg_name, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search vector
DROP TRIGGER IF EXISTS trg_playlist_entry_search ON playlist_entries;
CREATE TRIGGER trg_playlist_entry_search
  BEFORE INSERT OR UPDATE ON playlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_playlist_entry_search_vector();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_playlist_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_playlist_sources_updated ON playlist_sources;
CREATE TRIGGER trg_playlist_sources_updated
  BEFORE UPDATE ON playlist_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_playlist_sources_updated_at();

-- Function to acquire sync lock
CREATE OR REPLACE FUNCTION acquire_playlist_sync_lock(p_key TEXT, p_locked_by TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN := false;
BEGIN
  -- Clean expired locks first
  DELETE FROM playlist_sync_locks WHERE expires_at < now();
  
  -- Try to acquire lock
  INSERT INTO playlist_sync_locks (playlist_key, locked_by, locked_at, expires_at)
  VALUES (p_key, p_locked_by, now(), now() + interval '5 minutes')
  ON CONFLICT (playlist_key) DO NOTHING;
  
  -- Check if we got the lock
  SELECT EXISTS (
    SELECT 1 FROM playlist_sync_locks 
    WHERE playlist_key = p_key AND locked_by = p_locked_by
  ) INTO v_acquired;
  
  RETURN v_acquired;
END;
$$ LANGUAGE plpgsql;

-- Function to release sync lock
CREATE OR REPLACE FUNCTION release_playlist_sync_lock(p_key TEXT, p_locked_by TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM playlist_sync_locks 
  WHERE playlist_key = p_key AND locked_by = p_locked_by;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to search entries
CREATE OR REPLACE FUNCTION search_playlist_entries(
  p_query TEXT,
  p_playlist_key TEXT DEFAULT NULL,
  p_group_title TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  playlist_key TEXT,
  title TEXT,
  stream_url TEXT,
  group_title TEXT,
  tvg_logo TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.playlist_key,
    e.title,
    e.stream_url,
    e.group_title,
    e.tvg_logo,
    ts_rank(e.search_vector, plainto_tsquery('portuguese', p_query)) as rank
  FROM playlist_entries e
  WHERE e.is_valid = true
    AND (p_playlist_key IS NULL OR e.playlist_key = p_playlist_key)
    AND (p_group_title IS NULL OR e.group_title = p_group_title)
    AND (
      e.search_vector @@ plainto_tsquery('portuguese', p_query)
      OR e.title ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, e.title
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE playlist_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_sync_locks ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY "Admins full access playlist_sources" ON playlist_sources
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access playlist_sync_jobs" ON playlist_sync_jobs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access playlist_entries" ON playlist_entries
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access playlist_sync_locks" ON playlist_sync_locks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read entries
CREATE POLICY "Users can read playlist_entries" ON playlist_entries
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role playlist_sources" ON playlist_sources
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role playlist_sync_jobs" ON playlist_sync_jobs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role playlist_entries" ON playlist_entries
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role playlist_sync_locks" ON playlist_sync_locks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');