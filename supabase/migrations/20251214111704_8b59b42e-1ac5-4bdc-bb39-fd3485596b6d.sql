-- ============================================
-- IPTV PHASE 2: Multi-origin Failover + LL-HLS + Geo-Routing
-- ============================================

-- Origin servers for multi-origin failover
CREATE TABLE IF NOT EXISTS public.iptv_origin_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_id text UNIQUE NOT NULL,
  url text NOT NULL,
  region text NOT NULL DEFAULT 'global',
  health_score integer DEFAULT 100,
  latency_ms integer DEFAULT 0,
  is_healthy boolean DEFAULT true,
  is_active boolean DEFAULT true,
  fail_count integer DEFAULT 0,
  last_check_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.iptv_origin_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage origin servers"
  ON public.iptv_origin_servers
  FOR ALL
  USING (is_admin_or_master());

CREATE POLICY "Anyone can view active origins"
  ON public.iptv_origin_servers
  FOR SELECT
  USING (is_active = true);

-- LL-HLS channel-specific configuration
CREATE TABLE IF NOT EXISTS public.iptv_llhls_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id bigint REFERENCES public.iptv_channels(id) ON DELETE CASCADE,
  part_duration numeric DEFAULT 0.33,
  playlist_window integer DEFAULT 30,
  hold_back_multiplier numeric DEFAULT 3,
  can_skip_until integer DEFAULT 12,
  prefetch_segments integer DEFAULT 2,
  target_latency numeric DEFAULT 2.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(channel_id)
);

ALTER TABLE public.iptv_llhls_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage llhls config"
  ON public.iptv_llhls_config
  FOR ALL
  USING (is_admin_or_master());

CREATE POLICY "Anyone can view llhls config"
  ON public.iptv_llhls_config
  FOR SELECT
  USING (true);

-- Geo-routing logs
CREATE TABLE IF NOT EXISTS public.iptv_routing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_region text NOT NULL,
  selected_cdn text NOT NULL,
  latency_ms integer DEFAULT 0,
  stream_path text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.iptv_routing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage routing logs"
  ON public.iptv_routing_logs
  FOR ALL
  USING (is_admin_or_master());

CREATE POLICY "System can insert routing logs"
  ON public.iptv_routing_logs
  FOR INSERT
  WITH CHECK (true);

-- Index for routing analytics
CREATE INDEX IF NOT EXISTS idx_iptv_routing_logs_created_at 
  ON public.iptv_routing_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iptv_routing_logs_region 
  ON public.iptv_routing_logs(client_region);

-- Function to increment origin fail count
CREATE OR REPLACE FUNCTION public.increment_origin_fail_count(p_origin_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.iptv_origin_servers
  SET 
    fail_count = fail_count + 1,
    health_score = GREATEST(0, health_score - 10),
    is_healthy = CASE WHEN fail_count + 1 >= 5 THEN false ELSE is_healthy END,
    updated_at = now()
  WHERE origin_id = p_origin_id;
END;
$$;

-- Insert default origin servers
INSERT INTO public.iptv_origin_servers (origin_id, url, region, health_score, is_healthy)
VALUES 
  ('primary-br', 'https://origin-br.iptvlink.com.br', 'BR', 100, true),
  ('primary-us', 'https://origin-us.iptvlink.com.br', 'US', 100, true),
  ('fallback-global', 'https://origin.iptvlink.com.br', 'global', 90, true)
ON CONFLICT (origin_id) DO NOTHING;