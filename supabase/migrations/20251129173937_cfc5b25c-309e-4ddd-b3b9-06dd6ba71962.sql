-- Add Cloudflare Stream columns to m3u_channels
ALTER TABLE m3u_channels 
ADD COLUMN IF NOT EXISTS cf_stream_uid TEXT,
ADD COLUMN IF NOT EXISTS cf_stream_url TEXT,
ADD COLUMN IF NOT EXISTS cf_stream_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS cf_stream_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cf_stream_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS cf_stream_size_bytes BIGINT;

-- Index for Stream queries
CREATE INDEX IF NOT EXISTS idx_m3u_channels_cf_stream_status ON m3u_channels(cf_stream_status) WHERE is_vod = true;
CREATE INDEX IF NOT EXISTS idx_m3u_channels_cf_stream_uid ON m3u_channels(cf_stream_uid) WHERE cf_stream_uid IS NOT NULL;

-- Table to track Stream upload queue
CREATE TABLE IF NOT EXISTS cf_stream_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES m3u_channels(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  cf_stream_uid TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, uploading, processing, ready, error
  upload_type TEXT DEFAULT 'url', -- url (via URL copy) or tus (direct upload)
  progress_percent INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for upload queue
CREATE INDEX IF NOT EXISTS idx_cf_stream_uploads_status ON cf_stream_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cf_stream_uploads_channel_id ON cf_stream_uploads(channel_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_cf_stream_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cf_stream_uploads_updated_at ON cf_stream_uploads;
CREATE TRIGGER trigger_cf_stream_uploads_updated_at
BEFORE UPDATE ON cf_stream_uploads
FOR EACH ROW EXECUTE FUNCTION update_cf_stream_uploads_updated_at();

-- Enable RLS
ALTER TABLE cf_stream_uploads ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admins can manage stream uploads" ON cf_stream_uploads
FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Function to get Stream statistics
CREATE OR REPLACE FUNCTION get_cf_stream_statistics()
RETURNS TABLE (
  total_vods BIGINT,
  vods_on_stream BIGINT,
  vods_pending BIGINT,
  uploads_queued BIGINT,
  uploads_processing BIGINT,
  uploads_ready BIGINT,
  uploads_error BIGINT,
  total_duration_hours NUMERIC,
  estimated_monthly_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_minutes NUMERIC;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM m3u_channels WHERE is_vod = true)::BIGINT,
    (SELECT COUNT(*) FROM m3u_channels WHERE is_vod = true AND cf_stream_uid IS NOT NULL)::BIGINT,
    (SELECT COUNT(*) FROM m3u_channels WHERE is_vod = true AND cf_stream_uid IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'queued')::BIGINT,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status IN ('uploading', 'processing'))::BIGINT,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'ready')::BIGINT,
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'error')::BIGINT,
    ROUND(COALESCE(SUM(cf_stream_duration_seconds)::NUMERIC / 3600, 0), 2),
    ROUND(COALESCE(SUM(cf_stream_duration_seconds)::NUMERIC / 60 * 0.005, 0), 2) -- $5 per 1000 minutes
  FROM m3u_channels
  WHERE is_vod = true AND cf_stream_uid IS NOT NULL;
END;
$$;

-- Cleanup function for old failed uploads
CREATE OR REPLACE FUNCTION cleanup_old_cf_stream_uploads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove completed uploads older than 7 days
  DELETE FROM cf_stream_uploads
  WHERE status = 'ready' AND created_at < NOW() - INTERVAL '7 days';
  
  -- Reset stuck uploads (uploading for more than 1 hour)
  UPDATE cf_stream_uploads
  SET status = 'queued', started_at = NULL, retry_count = retry_count + 1
  WHERE status = 'uploading' 
    AND started_at < NOW() - INTERVAL '1 hour'
    AND retry_count < max_retries;
END;
$$;