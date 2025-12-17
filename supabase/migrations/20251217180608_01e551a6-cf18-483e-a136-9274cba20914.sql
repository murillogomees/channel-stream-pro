-- Table to track bulk R2 cache jobs
CREATE TABLE IF NOT EXISTS public.r2_bulk_cache_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  success_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  skipped_items INTEGER DEFAULT 0,
  current_batch INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 50,
  content_filter TEXT DEFAULT 'vod', -- 'vod', 'all', 'movies', 'series'
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Table to track individual item cache status
CREATE TABLE IF NOT EXISTS public.r2_cached_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  content_type TEXT, -- 'movie', 'series', 'episode'
  file_size BIGINT,
  mime_type TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  job_id UUID REFERENCES r2_bulk_cache_jobs(id),
  UNIQUE(channel_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_r2_cached_content_channel ON r2_cached_content(channel_id);
CREATE INDEX IF NOT EXISTS idx_r2_cached_content_job ON r2_cached_content(job_id);
CREATE INDEX IF NOT EXISTS idx_r2_bulk_jobs_status ON r2_bulk_cache_jobs(status);

-- Enable RLS
ALTER TABLE r2_bulk_cache_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_cached_content ENABLE ROW LEVEL SECURITY;

-- Policies for admin/master access
CREATE POLICY "Admin can manage bulk cache jobs" ON r2_bulk_cache_jobs
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin can manage cached content" ON r2_cached_content
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- Function to get uncached VOD channels
CREATE OR REPLACE FUNCTION public.get_uncached_vod_channels(p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  channel_id INTEGER,
  channel_name TEXT,
  original_url TEXT,
  category TEXT,
  content_type TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ic.id as channel_id,
    ic.name as channel_name,
    ic.original_url,
    ic.category,
    ic.content_type
  FROM iptv_channels ic
  LEFT JOIN r2_cached_content rcc ON rcc.channel_id = ic.id
  WHERE rcc.id IS NULL
    AND ic.content_type IN ('vod', 'movie', 'series')
    AND ic.original_url IS NOT NULL
    AND ic.original_url != ''
  ORDER BY ic.id
  LIMIT p_limit
  OFFSET p_offset;
$$;