-- Add metadata column to vod_downloads for storing resume information
ALTER TABLE vod_downloads ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN vod_downloads.metadata IS 'Stores resume information like upload_id, parts, and progress for resumable downloads';