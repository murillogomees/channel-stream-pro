-- Storage Sync Events table - tracks R2 to CF Stream auto-sync
CREATE TABLE IF NOT EXISTS public.storage_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'r2', -- 'r2' | 'cfstream'
  target_type TEXT NOT NULL DEFAULT 'cfstream', -- 'cfstream' | 'r2'
  channel_id UUID REFERENCES public.m3u_channels(id) ON DELETE CASCADE,
  source_url TEXT,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'syncing' | 'completed' | 'failed'
  error_message TEXT,
  file_size_bytes BIGINT,
  sync_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.storage_sync_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for storage_sync_events
CREATE POLICY "Admin can manage storage_sync_events"
ON public.storage_sync_events
FOR ALL
USING (public.is_admin_or_master(auth.uid()));

-- Storage config table for auto-sync settings
CREATE TABLE IF NOT EXISTS public.storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.storage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage storage_config"
ON public.storage_config
FOR ALL
USING (public.is_admin_or_master(auth.uid()));

-- Insert default config
INSERT INTO public.storage_config (config_key, config_value, description)
VALUES 
  ('auto_transcode_enabled', '{"enabled": true}'::jsonb, 'Enable automatic R2 to CF Stream transcoding'),
  ('transcode_preset', '{"preset": "standard"}'::jsonb, 'Default transcode quality preset'),
  ('cost_thresholds', '{"monthly_alert": 100, "bandwidth_alert": 1000}'::jsonb, 'Cost alert thresholds in USD')
ON CONFLICT (config_key) DO NOTHING;

-- Consolidated storage view
CREATE OR REPLACE VIEW public.vw_storage_consolidated AS
SELECT 
  'r2' as source,
  r2_key as key,
  COALESCE(size_bytes, 0) as size_bytes,
  created_at,
  source_channel_id as channel_id,
  status,
  content_type,
  access_count,
  bandwidth_bytes
FROM public.r2_storage_objects
WHERE status = 'ready'
UNION ALL
SELECT 
  'cfstream' as source,
  cf_stream_uid as key,
  COALESCE((metadata->>'size_bytes')::bigint, 0) as size_bytes,
  created_at,
  channel_id,
  status,
  'video/mp4' as content_type,
  0 as access_count,
  0 as bandwidth_bytes
FROM public.cf_stream_uploads
WHERE status = 'ready';

-- Monthly storage stats table for historical tracking
CREATE TABLE IF NOT EXISTS public.storage_monthly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  r2_objects_count INTEGER DEFAULT 0,
  r2_total_bytes BIGINT DEFAULT 0,
  r2_bandwidth_bytes BIGINT DEFAULT 0,
  cf_objects_count INTEGER DEFAULT 0,
  cf_total_bytes BIGINT DEFAULT 0,
  cf_minutes_stored NUMERIC(12,2) DEFAULT 0,
  cf_minutes_delivered NUMERIC(12,2) DEFAULT 0,
  estimated_cost_usd NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month)
);

ALTER TABLE public.storage_monthly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view storage_monthly_stats"
ON public.storage_monthly_stats
FOR SELECT
USING (public.is_admin_or_master(auth.uid()));

-- Function to calculate and store monthly stats
CREATE OR REPLACE FUNCTION public.calculate_storage_monthly_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month DATE := date_trunc('month', now())::date;
  v_r2_count INTEGER;
  v_r2_bytes BIGINT;
  v_r2_bandwidth BIGINT;
  v_cf_count INTEGER;
  v_cf_bytes BIGINT;
  v_cf_minutes NUMERIC;
  v_cost NUMERIC;
BEGIN
  -- R2 stats
  SELECT 
    COUNT(*),
    COALESCE(SUM(size_bytes), 0),
    COALESCE(SUM(bandwidth_bytes), 0)
  INTO v_r2_count, v_r2_bytes, v_r2_bandwidth
  FROM r2_storage_objects WHERE status = 'ready';
  
  -- CF Stream stats
  SELECT 
    COUNT(*),
    COALESCE(SUM((metadata->>'size_bytes')::bigint), 0),
    COALESCE(SUM((metadata->>'duration_seconds')::numeric / 60), 0)
  INTO v_cf_count, v_cf_bytes, v_cf_minutes
  FROM cf_stream_uploads WHERE status = 'ready';
  
  -- Calculate estimated cost (R2: $0.015/GB, CF: $0.005/min storage + $0.01/min encoding)
  v_cost := (v_r2_bytes::numeric / 1073741824 * 0.015) + (v_cf_minutes * 0.005) + (v_cf_minutes * 0.01);
  
  -- Upsert monthly stats
  INSERT INTO storage_monthly_stats (month, r2_objects_count, r2_total_bytes, r2_bandwidth_bytes, 
    cf_objects_count, cf_total_bytes, cf_minutes_stored, estimated_cost_usd)
  VALUES (v_month, v_r2_count, v_r2_bytes, v_r2_bandwidth, v_cf_count, v_cf_bytes, v_cf_minutes, v_cost)
  ON CONFLICT (month) DO UPDATE SET
    r2_objects_count = EXCLUDED.r2_objects_count,
    r2_total_bytes = EXCLUDED.r2_total_bytes,
    r2_bandwidth_bytes = EXCLUDED.r2_bandwidth_bytes,
    cf_objects_count = EXCLUDED.cf_objects_count,
    cf_total_bytes = EXCLUDED.cf_total_bytes,
    cf_minutes_stored = EXCLUDED.cf_minutes_stored,
    estimated_cost_usd = EXCLUDED.estimated_cost_usd,
    created_at = now();
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_storage_sync_events_status ON public.storage_sync_events(status);
CREATE INDEX IF NOT EXISTS idx_storage_sync_events_channel ON public.storage_sync_events(channel_id);
CREATE INDEX IF NOT EXISTS idx_storage_monthly_stats_month ON public.storage_monthly_stats(month DESC);