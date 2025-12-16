-- =============================================================================
-- Phase 2: Streaming Optimization - Scheduled Health Checks
-- =============================================================================

-- Create cron job for origin health checks (every 30 seconds)
SELECT cron.schedule(
  'origin-health-check-30s',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/origin-health-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Update iptv_origin_servers with additional columns if needed
ALTER TABLE public.iptv_origin_servers 
  ADD COLUMN IF NOT EXISTS bandwidth_mbps INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS concurrent_streams INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_concurrent_streams INTEGER DEFAULT 10000;

-- Create index for faster origin selection
CREATE INDEX IF NOT EXISTS idx_origin_servers_selection 
  ON public.iptv_origin_servers (is_active, is_healthy, health_score DESC);

-- Create view for origin statistics
CREATE OR REPLACE VIEW public.v_origin_statistics AS
SELECT 
  origin_id,
  url,
  region,
  is_active,
  is_healthy,
  health_score,
  latency_ms,
  fail_count,
  last_check_at,
  bandwidth_mbps,
  concurrent_streams,
  max_concurrent_streams,
  CASE 
    WHEN health_score >= 90 THEN 'excellent'
    WHEN health_score >= 70 THEN 'good'
    WHEN health_score >= 50 THEN 'fair'
    WHEN health_score >= 30 THEN 'poor'
    ELSE 'critical'
  END as health_status
FROM public.iptv_origin_servers
ORDER BY health_score DESC;

-- Create function to get best origin for a region
CREATE OR REPLACE FUNCTION public.get_best_origin_for_region(p_region TEXT DEFAULT 'BR')
RETURNS TABLE(
  origin_id TEXT,
  url TEXT,
  region TEXT,
  health_score INTEGER,
  latency_ms INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.origin_id,
    o.url,
    o.region,
    o.health_score,
    o.latency_ms
  FROM public.iptv_origin_servers o
  WHERE o.is_active = true 
    AND o.is_healthy = true
  ORDER BY 
    CASE WHEN o.region = p_region THEN 0 ELSE 1 END,
    o.health_score DESC,
    o.latency_ms ASC
  LIMIT 3;
END;
$$;

-- Insert default LL-HLS configs for live content
INSERT INTO public.iptv_llhls_config (channel_id, target_latency, part_duration, hold_back_multiplier, prefetch_segments, playlist_window, can_skip_until)
SELECT 
  id,
  3.0,   -- 3 second target latency
  0.5,   -- 500ms parts
  2.0,   -- 2x hold back
  2,     -- 2 prefetch segments
  30,    -- 30 second window
  6.0    -- Can skip 6 seconds
FROM public.iptv_channels
WHERE id NOT IN (SELECT channel_id FROM public.iptv_llhls_config WHERE channel_id IS NOT NULL)
LIMIT 100
ON CONFLICT (channel_id) DO NOTHING;