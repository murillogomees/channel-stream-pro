-- ============================================================================
-- Transcode Job Queue System
-- ============================================================================

-- Job status enum
DO $$ BEGIN
  CREATE TYPE transcode_job_status AS ENUM ('queued', 'processing', 'ready', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Quality ladder presets
DO $$ BEGIN
  CREATE TYPE quality_ladder_preset AS ENUM ('basic', 'standard', 'premium', 'ultra');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main transcode jobs table
CREATE TABLE IF NOT EXISTS public.transcode_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source info
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_resolution JSONB, -- {width, height, fps, bitrate, codec}
  
  -- Job metadata
  status transcode_job_status NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = more urgent
  
  -- Quality ladder configuration
  ladder_preset quality_ladder_preset NOT NULL DEFAULT 'standard',
  ladder_config JSONB, -- Custom ladder rules if needed
  
  -- Cloudflare Stream integration
  cf_stream_uid TEXT,
  cf_upload_id TEXT,
  
  -- Results
  output_manifests JSONB, -- HLS/DASH manifest URLs
  output_thumbnails JSONB, -- Thumbnail URLs
  output_metadata JSONB, -- Duration, final resolutions, etc.
  
  -- Processing info
  processor_id TEXT, -- Which worker is processing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_after TIMESTAMPTZ,
  
  -- Analytics for dynamic ladder
  historical_views INTEGER DEFAULT 0,
  estimated_popularity DECIMAL(5,2), -- 0-100 score
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_transcode_jobs_status_priority 
  ON transcode_jobs(status, priority DESC, created_at ASC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_transcode_jobs_processing 
  ON transcode_jobs(processor_id, started_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_transcode_jobs_channel 
  ON transcode_jobs(channel_id);

CREATE INDEX IF NOT EXISTS idx_transcode_jobs_cf_uid 
  ON transcode_jobs(cf_stream_uid)
  WHERE cf_stream_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transcode_jobs_retry 
  ON transcode_jobs(retry_after)
  WHERE status = 'queued' AND retry_after IS NOT NULL;

-- Enable RLS
ALTER TABLE public.transcode_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
CREATE POLICY "Admins can view all transcode jobs"
  ON transcode_jobs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage transcode jobs"
  ON transcode_jobs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access"
  ON transcode_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Job status history for auditing
CREATE TABLE IF NOT EXISTS public.transcode_job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES transcode_jobs(id) ON DELETE CASCADE,
  old_status transcode_job_status,
  new_status transcode_job_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT, -- processor_id or 'webhook' or 'manual'
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_transcode_job_history_job 
  ON transcode_job_history(job_id, changed_at DESC);

-- RLS for history
ALTER TABLE public.transcode_job_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view job history"
  ON transcode_job_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can manage job history"
  ON transcode_job_history FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update job status with history logging
CREATE OR REPLACE FUNCTION update_transcode_job_status(
  p_job_id UUID,
  p_new_status transcode_job_status,
  p_changed_by TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status transcode_job_status;
BEGIN
  -- Get current status
  SELECT status INTO v_old_status FROM transcode_jobs WHERE id = p_job_id;
  
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  -- Update job status
  UPDATE transcode_jobs 
  SET 
    status = p_new_status,
    updated_at = now(),
    started_at = CASE WHEN p_new_status = 'processing' AND started_at IS NULL THEN now() ELSE started_at END,
    completed_at = CASE WHEN p_new_status IN ('ready', 'failed', 'cancelled') THEN now() ELSE completed_at END
  WHERE id = p_job_id;
  
  -- Log history
  INSERT INTO transcode_job_history (job_id, old_status, new_status, changed_by, metadata)
  VALUES (p_job_id, v_old_status, p_new_status, p_changed_by, p_metadata);
END;
$$;

-- Function to acquire next job from queue (atomic)
CREATE OR REPLACE FUNCTION acquire_transcode_job(p_processor_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Select and lock the highest priority queued job
  SELECT id INTO v_job_id
  FROM transcode_jobs
  WHERE status = 'queued'
    AND (retry_after IS NULL OR retry_after <= now())
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_job_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Mark as processing
  UPDATE transcode_jobs
  SET 
    status = 'processing',
    processor_id = p_processor_id,
    started_at = now(),
    updated_at = now()
  WHERE id = v_job_id;
  
  -- Log status change
  INSERT INTO transcode_job_history (job_id, old_status, new_status, changed_by)
  VALUES (v_job_id, 'queued', 'processing', p_processor_id);
  
  RETURN v_job_id;
END;
$$;

-- Function to calculate dynamic ladder based on popularity
CREATE OR REPLACE FUNCTION calculate_ladder_preset(
  p_historical_views INTEGER,
  p_source_width INTEGER,
  p_source_height INTEGER
)
RETURNS quality_ladder_preset
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_max_resolution INTEGER;
  v_popularity_score DECIMAL;
BEGIN
  v_max_resolution := GREATEST(p_source_width, p_source_height);
  
  -- Calculate popularity score (logarithmic scale)
  v_popularity_score := CASE 
    WHEN p_historical_views <= 0 THEN 0
    WHEN p_historical_views < 100 THEN 25
    WHEN p_historical_views < 1000 THEN 50
    WHEN p_historical_views < 10000 THEN 75
    ELSE 100
  END;
  
  -- Determine ladder based on popularity and source resolution
  IF v_max_resolution >= 2160 AND v_popularity_score >= 75 THEN
    RETURN 'ultra';
  ELSIF v_max_resolution >= 1080 AND v_popularity_score >= 50 THEN
    RETURN 'premium';
  ELSIF v_max_resolution >= 720 AND v_popularity_score >= 25 THEN
    RETURN 'standard';
  ELSE
    RETURN 'basic';
  END IF;
END;
$$;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_transcode_queue_stats()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'queued', COUNT(*) FILTER (WHERE status = 'queued'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'ready', COUNT(*) FILTER (WHERE status = 'ready'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'total_today', COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
    'avg_processing_time_ms', ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) FILTER (WHERE status = 'ready')),
    'oldest_queued', MIN(created_at) FILTER (WHERE status = 'queued'),
    'active_processors', COUNT(DISTINCT processor_id) FILTER (WHERE status = 'processing')
  )
  FROM transcode_jobs;
$$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_transcode_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_transcode_jobs_updated_at ON transcode_jobs;
CREATE TRIGGER trigger_update_transcode_jobs_updated_at
  BEFORE UPDATE ON transcode_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_transcode_jobs_updated_at();