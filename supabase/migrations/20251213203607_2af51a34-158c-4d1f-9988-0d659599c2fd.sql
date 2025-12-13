-- Add unique constraint for upsert operations
ALTER TABLE public.m3u_sync_entries 
ADD CONSTRAINT m3u_sync_entries_source_url_unique 
UNIQUE (source_id, stream_url);