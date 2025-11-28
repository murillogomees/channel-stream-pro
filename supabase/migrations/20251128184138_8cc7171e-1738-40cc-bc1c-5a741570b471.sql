-- Add sync_progress column to track resumable sync progress
ALTER TABLE public.playlist_sources 
ADD COLUMN IF NOT EXISTS sync_progress jsonb DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.playlist_sources.sync_progress IS 'Tracks progress for resumable sync operations';