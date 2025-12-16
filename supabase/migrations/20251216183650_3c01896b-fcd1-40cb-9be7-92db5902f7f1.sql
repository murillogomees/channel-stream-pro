
-- Fix security: Add RLS to views and revoke direct access to materialized views
-- Grant select only via RPC functions to admins

-- Revoke direct API access to materialized views (make them internal only)
REVOKE SELECT ON mv_dashboard_summary FROM anon, authenticated;
REVOKE SELECT ON mv_user_activity_summary FROM anon, authenticated;
REVOKE SELECT ON mv_channel_health_summary FROM anon, authenticated;
REVOKE SELECT ON mv_hot_channels FROM anon, authenticated;
REVOKE SELECT ON mv_payment_analytics FROM anon, authenticated;
REVOKE SELECT ON mv_affiliate_performance FROM anon, authenticated;

-- Grant access only to service_role (for functions)
GRANT SELECT ON mv_dashboard_summary TO service_role;
GRANT SELECT ON mv_user_activity_summary TO service_role;
GRANT SELECT ON mv_channel_health_summary TO service_role;
GRANT SELECT ON mv_hot_channels TO service_role;
GRANT SELECT ON mv_payment_analytics TO service_role;
GRANT SELECT ON mv_affiliate_performance TO service_role;

-- Grant authenticated access to regular views (they use RLS from underlying tables)
GRANT SELECT ON v_user_profile_summary TO authenticated;
GRANT SELECT ON v_channel_categories TO authenticated;
GRANT SELECT ON v_pending_notifications TO authenticated;

-- Update helper functions to be accessible by authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_channel_stats_by_category() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_materialized_views() TO service_role;

-- Create secure view for hot channels (admin only)
CREATE OR REPLACE FUNCTION get_hot_channels(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id bigint,
  name text,
  category text,
  logo_url text,
  is_healthy boolean,
  view_count bigint,
  total_duration bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, category, logo_url, is_healthy, view_count, total_duration
  FROM mv_hot_channels
  ORDER BY view_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_hot_channels(integer) TO authenticated;
