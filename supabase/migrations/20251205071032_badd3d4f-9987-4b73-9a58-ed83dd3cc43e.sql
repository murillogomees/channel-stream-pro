-- Complete remaining tables
ALTER TABLE public.watch_history ADD COLUMN IF NOT EXISTS last_watched_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_watch_history_profile ON watch_history(profile_id, last_watched_at DESC);

CREATE TABLE IF NOT EXISTS public.stream_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type VARCHAR(50) NOT NULL UNIQUE,
  max_concurrent_streams INTEGER DEFAULT 2,
  max_profiles INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO stream_limits (plan_type, max_concurrent_streams, max_profiles) VALUES
  ('Mensal', 2, 3), ('Trimestral', 3, 4), ('Semestral', 4, 5), ('Anual', 5, 5)
ON CONFLICT (plan_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.channel_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'unknown',
  last_check_at TIMESTAMPTZ DEFAULT now(),
  consecutive_failures INTEGER DEFAULT 0,
  uptime_percentage NUMERIC(5,2) DEFAULT 100,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.qos_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID,
  timestamp TIMESTAMPTZ DEFAULT now(),
  latency_ms INTEGER,
  bitrate_kbps INTEGER,
  rebuffer_count INTEGER DEFAULT 0,
  viewer_count INTEGER DEFAULT 1
);

ALTER TABLE stream_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE qos_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads stream limits" ON stream_limits FOR SELECT USING (true);
CREATE POLICY "Anyone reads health" ON channel_health FOR SELECT USING (true);
CREATE POLICY "System inserts qos" ON qos_metrics FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION check_stream_limit(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_plan TEXT; v_max INTEGER; v_count INTEGER;
BEGIN
  SELECT plano INTO v_plan FROM clientes WHERE user_id = p_user_id;
  SELECT max_concurrent_streams INTO v_max FROM stream_limits WHERE plan_type = v_plan;
  v_max := COALESCE(v_max, 2);
  SELECT COUNT(*) INTO v_count FROM active_streams WHERE user_id = p_user_id AND last_heartbeat > now() - interval '2 minutes';
  RETURN jsonb_build_object('can_stream', v_count < v_max, 'active', v_count, 'max', v_max);
END;
$$;