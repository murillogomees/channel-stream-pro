-- Create m3u_sync_entries table for M3U playlist import/sync
CREATE TABLE IF NOT EXISTS public.m3u_sync_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID,
  title TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  tvg_logo TEXT,
  tvg_id TEXT,
  tvg_name TEXT,
  group_title TEXT,
  stream_type TEXT DEFAULT 'live',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_group ON public.m3u_sync_entries(group_title);
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_source ON public.m3u_sync_entries(source_id);
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_active ON public.m3u_sync_entries(is_active);

-- Enable RLS
ALTER TABLE public.m3u_sync_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage m3u_sync_entries" 
ON public.m3u_sync_entries 
FOR ALL 
USING (is_admin_or_master());

CREATE POLICY "Authenticated can view active entries" 
ON public.m3u_sync_entries 
FOR SELECT 
USING (is_active = true);

-- Create m3u_sources table for managing playlist sources
CREATE TABLE IF NOT EXISTS public.m3u_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  source_type TEXT DEFAULT 'url',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',
  entry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for m3u_sources
ALTER TABLE public.m3u_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies for m3u_sources
CREATE POLICY "Admins can manage m3u_sources" 
ON public.m3u_sources 
FOR ALL 
USING (is_admin_or_master());

CREATE POLICY "Authenticated can view sources" 
ON public.m3u_sources 
FOR SELECT 
USING (auth.uid() IS NOT NULL);