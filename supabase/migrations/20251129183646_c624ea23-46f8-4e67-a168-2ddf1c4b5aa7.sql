-- Streaming Policy Engine table for hybrid routing
CREATE TABLE IF NOT EXISTS public.streaming_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('live_linear', 'vod', 'agile', 'unknown')),
  strategy TEXT NOT NULL DEFAULT 'USE_ORIGIN' CHECK (strategy IN ('USE_STREAM', 'USE_ORIGIN', 'STREAM_ON_DEMAND')),
  priority INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Per-channel routing overrides
CREATE TABLE IF NOT EXISTS public.channel_routing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES m3u_channels(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('USE_STREAM', 'USE_ORIGIN', 'STREAM_ON_DEMAND', 'AUTO')),
  force_origin BOOLEAN DEFAULT false,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id)
);

-- Streaming metrics for decision making
CREATE TABLE IF NOT EXISTS public.streaming_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Signed token keys for VOD security
CREATE TABLE IF NOT EXISTS public.stream_signing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id TEXT NOT NULL UNIQUE,
  secret_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_streaming_policies_active ON streaming_policies(is_active, content_type);
CREATE INDEX IF NOT EXISTS idx_channel_routing_channel ON channel_routing_overrides(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_routing_expires ON channel_routing_overrides(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_streaming_metrics_channel ON streaming_metrics(channel_id, metric_type, recorded_at DESC);

-- Enable RLS
ALTER TABLE streaming_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_routing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_signing_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only for management)
DROP POLICY IF EXISTS "Admin can manage streaming policies" ON streaming_policies;
CREATE POLICY "Admin can manage streaming policies" ON streaming_policies FOR ALL 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can manage routing overrides" ON channel_routing_overrides;
CREATE POLICY "Admin can manage routing overrides" ON channel_routing_overrides FOR ALL 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can view streaming metrics" ON streaming_metrics;
CREATE POLICY "Admin can view streaming metrics" ON streaming_metrics FOR SELECT 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can insert streaming metrics" ON streaming_metrics;
CREATE POLICY "System can insert streaming metrics" ON streaming_metrics FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can manage signing keys" ON stream_signing_keys;
CREATE POLICY "Admin can manage signing keys" ON stream_signing_keys FOR ALL 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Function to get routing strategy for a channel
CREATE OR REPLACE FUNCTION get_channel_routing_strategy(p_channel_id UUID)
RETURNS TABLE(
  strategy TEXT,
  force_origin BOOLEAN,
  source TEXT,
  cf_stream_url TEXT,
  r2_url TEXT,
  origin_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_channel RECORD;
  v_override RECORD;
  v_policy RECORD;
  v_strategy TEXT := 'USE_ORIGIN';
  v_force_origin BOOLEAN := false;
  v_source TEXT := 'default';
BEGIN
  SELECT * INTO v_channel FROM m3u_channels WHERE id = p_channel_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_override FROM channel_routing_overrides 
  WHERE channel_id = p_channel_id AND (expires_at IS NULL OR expires_at > now());
  
  IF FOUND AND v_override.strategy != 'AUTO' THEN
    v_strategy := v_override.strategy;
    v_force_origin := v_override.force_origin;
    v_source := 'override';
  ELSE
    SELECT * INTO v_policy FROM streaming_policies 
    WHERE is_active = true AND content_type = COALESCE(v_channel.content_type, 'unknown')
    ORDER BY priority DESC LIMIT 1;
    
    IF FOUND THEN
      v_strategy := v_policy.strategy;
      v_source := 'policy';
    ELSE
      IF v_channel.is_vod = true AND v_channel.cf_stream_url IS NOT NULL THEN
        v_strategy := 'USE_STREAM';
        v_source := 'auto_vod';
      ELSIF v_channel.r2_url IS NOT NULL THEN
        v_strategy := 'USE_ORIGIN';
        v_source := 'auto_r2';
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT v_strategy, v_force_origin, v_source, v_channel.cf_stream_url, v_channel.r2_url, v_channel.stream_url;
END;
$$;

-- Insert default policies (ignore if already exist)
INSERT INTO streaming_policies (content_type, strategy, priority, conditions) 
SELECT 'vod', 'USE_STREAM', 100, '{"description": "VODs use Cloudflare Stream by default"}'
WHERE NOT EXISTS (SELECT 1 FROM streaming_policies WHERE content_type = 'vod');

INSERT INTO streaming_policies (content_type, strategy, priority, conditions) 
SELECT 'live_linear', 'USE_ORIGIN', 100, '{"description": "Live channels use direct origin"}'
WHERE NOT EXISTS (SELECT 1 FROM streaming_policies WHERE content_type = 'live_linear');

INSERT INTO streaming_policies (content_type, strategy, priority, conditions) 
SELECT 'agile', 'USE_ORIGIN', 50, '{"description": "Agile content from origin with edge cache"}'
WHERE NOT EXISTS (SELECT 1 FROM streaming_policies WHERE content_type = 'agile');

INSERT INTO streaming_policies (content_type, strategy, priority, conditions) 
SELECT 'unknown', 'USE_ORIGIN', 0, '{"description": "Unknown content defaults to origin"}'
WHERE NOT EXISTS (SELECT 1 FROM streaming_policies WHERE content_type = 'unknown');