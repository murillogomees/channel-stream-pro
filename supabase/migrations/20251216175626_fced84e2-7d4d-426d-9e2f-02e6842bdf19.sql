-- Fix Security Definer View - convert to regular view with RLS
DROP VIEW IF EXISTS public.v_origin_statistics;

CREATE VIEW public.v_origin_statistics AS
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

-- Grant access to the view
GRANT SELECT ON public.v_origin_statistics TO authenticated;
GRANT SELECT ON public.v_origin_statistics TO anon;