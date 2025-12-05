-- Storage Config table
CREATE TABLE IF NOT EXISTS public.storage_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Storage Sync Events table
CREATE TABLE IF NOT EXISTS public.storage_sync_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT,
  source_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  source_url TEXT,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  file_size_bytes BIGINT,
  sync_duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Storage Monthly Stats table
CREATE TABLE IF NOT EXISTS public.storage_monthly_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  r2_total_bytes BIGINT DEFAULT 0,
  r2_objects_count INTEGER DEFAULT 0,
  cf_total_bytes BIGINT DEFAULT 0,
  cf_objects_count INTEGER DEFAULT 0,
  cf_total_minutes NUMERIC DEFAULT 0,
  estimated_cost_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.storage_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_monthly_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for storage_config
CREATE POLICY "Admins can manage storage config" ON public.storage_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'master')
  )
);

-- RLS Policies for storage_sync_events
CREATE POLICY "Admins can view sync events" ON public.storage_sync_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'master')
  )
);

CREATE POLICY "Service can insert sync events" ON public.storage_sync_events
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update sync events" ON public.storage_sync_events
FOR UPDATE USING (true);

-- RLS Policies for storage_monthly_stats
CREATE POLICY "Admins can view monthly stats" ON public.storage_monthly_stats
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'master')
  )
);

CREATE POLICY "Service can manage monthly stats" ON public.storage_monthly_stats
FOR ALL USING (true);

-- Insert default config values
INSERT INTO public.storage_config (config_key, config_value, description) VALUES
  ('auto_transcode_enabled', '{"enabled": true}', 'Enable automatic R2 to CF Stream sync'),
  ('transcode_preset', '{"preset": "standard"}', 'Quality preset for transcoding'),
  ('cost_thresholds', '{"monthly_alert": 100}', 'Cost alert thresholds')
ON CONFLICT (config_key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_storage_sync_events_channel ON public.storage_sync_events(channel_id);
CREATE INDEX IF NOT EXISTS idx_storage_sync_events_status ON public.storage_sync_events(status);
CREATE INDEX IF NOT EXISTS idx_storage_sync_events_created ON public.storage_sync_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_monthly_stats_month ON public.storage_monthly_stats(month DESC);