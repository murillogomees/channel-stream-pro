
-- Drop existing materialized views first
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_user_activity_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_channel_health_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_hot_channels CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_payment_analytics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_affiliate_performance CASCADE;

-- Drop regular views
DROP VIEW IF EXISTS v_user_profile_summary CASCADE;
DROP VIEW IF EXISTS v_channel_categories CASCADE;
DROP VIEW IF EXISTS v_pending_notifications CASCADE;

-- 1. Dashboard Summary
CREATE MATERIALIZED VIEW mv_dashboard_summary AS
SELECT 
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM profiles WHERE cliente_ativo = true) as active_users,
  (SELECT COUNT(*) FROM profiles WHERE situacao = 'trial') as trial_users,
  (SELECT COUNT(*) FROM profiles WHERE data_vencimento < NOW()) as expired_users,
  (SELECT COUNT(*) FROM profiles WHERE data_vencimento BETWEEN NOW() AND NOW() + INTERVAL '7 days') as expiring_soon,
  (SELECT COUNT(*) FROM iptv_channels) as total_channels,
  (SELECT COUNT(*) FROM iptv_channels WHERE is_healthy = true) as healthy_channels,
  (SELECT COUNT(DISTINCT category) FROM iptv_channels) as total_categories,
  (SELECT COUNT(DISTINCT series_name) FROM iptv_channels WHERE is_series = true) as total_series,
  (SELECT COUNT(*) FROM payments WHERE status = 'approved') as approved_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'approved' AND created_at > NOW() - INTERVAL '30 days') as monthly_revenue,
  NOW() as last_refresh;

CREATE UNIQUE INDEX idx_mv_dashboard_summary ON mv_dashboard_summary (last_refresh);

-- 2. User Activity Summary
CREATE MATERIALIZED VIEW mv_user_activity_summary AS
SELECT 
  al.user_id,
  COUNT(*) as total_actions,
  COUNT(DISTINCT DATE(al.created_at)) as active_days,
  MAX(al.created_at) as last_activity,
  array_agg(DISTINCT al.action) FILTER (WHERE al.action IS NOT NULL) as action_types
FROM activity_logs al
WHERE al.created_at > NOW() - INTERVAL '30 days'
GROUP BY al.user_id;

CREATE UNIQUE INDEX idx_mv_user_activity_user ON mv_user_activity_summary (user_id);

-- 3. Channel Health Summary
CREATE MATERIALIZED VIEW mv_channel_health_summary AS
SELECT 
  ic.category,
  COUNT(*) as channel_count,
  COUNT(*) FILTER (WHERE ic.is_healthy = true) as healthy_count,
  COUNT(*) FILTER (WHERE ic.is_healthy = false) as unhealthy_count,
  ROUND(AVG(ic.health_score)::numeric, 2) as avg_health_score,
  COUNT(*) FILTER (WHERE ic.is_series = true) as series_count
FROM iptv_channels ic
GROUP BY ic.category;

CREATE UNIQUE INDEX idx_mv_channel_health_cat ON mv_channel_health_summary (category);

-- 4. Hot Channels
CREATE MATERIALIZED VIEW mv_hot_channels AS
SELECT 
  c.id,
  c.name,
  c.category,
  c.logo_url,
  c.is_healthy,
  c.health_score,
  c.original_url,
  c.slug,
  COALESCE(v.view_count, 0) as view_count,
  COALESCE(v.total_duration, 0) as total_duration
FROM iptv_channels c
LEFT JOIN (
  SELECT uvh.channel_id, COUNT(*) as view_count, SUM(uvh.watch_duration) as total_duration
  FROM user_viewing_history uvh
  WHERE uvh.watched_at > NOW() - INTERVAL '7 days'
  GROUP BY uvh.channel_id
) v ON c.id = v.channel_id
ORDER BY COALESCE(v.view_count, 0) DESC
LIMIT 500;

CREATE UNIQUE INDEX idx_mv_hot_channels_id ON mv_hot_channels (id);

-- 5. Payment Analytics
CREATE MATERIALIZED VIEW mv_payment_analytics AS
SELECT 
  DATE_TRUNC('day', p.created_at) as date,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE p.status = 'approved') as approved,
  COUNT(*) FILTER (WHERE p.status = 'pending') as pending,
  COUNT(*) FILTER (WHERE p.status = 'rejected') as rejected,
  SUM(p.amount) FILTER (WHERE p.status = 'approved') as revenue,
  AVG(p.amount) FILTER (WHERE p.status = 'approved') as avg_ticket
FROM payments p
WHERE p.created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', p.created_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_mv_payment_analytics_date ON mv_payment_analytics (date);

-- 6. Affiliate Performance
CREATE MATERIALIZED VIEW mv_affiliate_performance AS
SELECT 
  a.id as affiliate_id,
  a.code,
  a.name,
  a.commission_rate,
  COUNT(DISTINCT r.id) as total_referrals,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted') as conversions,
  COALESCE(SUM(r.commission_earned), 0) as total_commission,
  COUNT(DISTINCT lc.id) as total_clicks,
  ROUND(
    CASE WHEN COUNT(DISTINCT lc.id) > 0 
    THEN (COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted')::numeric / COUNT(DISTINCT lc.id) * 100)
    ELSE 0 END, 2
  ) as conversion_rate
FROM affiliates a
LEFT JOIN affiliate_referrals r ON a.id = r.affiliate_id
LEFT JOIN affiliate_link_clicks lc ON a.id = lc.affiliate_id
GROUP BY a.id, a.code, a.name, a.commission_rate;

CREATE UNIQUE INDEX idx_mv_affiliate_perf ON mv_affiliate_performance (affiliate_id);

-- 7. User Profile Summary View
CREATE VIEW v_user_profile_summary AS
SELECT 
  p.id,
  p.nome,
  p.email,
  p.contact_phone,
  p.plano,
  p.situacao,
  p.cliente_ativo,
  p.data_vencimento,
  p.data_contratacao,
  ur.role,
  CASE 
    WHEN p.data_vencimento IS NULL THEN 'unknown'
    WHEN p.data_vencimento < NOW() THEN 'expired'
    WHEN p.data_vencimento < NOW() + INTERVAL '3 days' THEN 'expiring'
    ELSE 'active'
  END as subscription_status
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id;

-- 8. Channel Categories View
CREATE VIEW v_channel_categories AS
SELECT 
  ic.category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ic.is_healthy = true) as healthy,
  COUNT(*) FILTER (WHERE ic.is_series = true) as series
FROM iptv_channels ic
WHERE ic.category IS NOT NULL
GROUP BY ic.category
ORDER BY COUNT(*) DESC;

-- 9. Pending Notifications View (corrected column names)
CREATE VIEW v_pending_notifications AS
SELECT 
  nq.id,
  nq.recipient_phone,
  nq.recipient_name,
  nq.message_content,
  nq.status,
  nq.scheduled_at,
  nq.created_at
FROM notification_queue nq
WHERE nq.status = 'pending'
ORDER BY nq.scheduled_at ASC;

-- 10. Refresh all function
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_channel_health_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hot_channels;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_payment_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_affiliate_performance;
END;
$$;

-- 11. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_vencimento ON profiles(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_profiles_situacao_ativo ON profiles(situacao, cliente_ativo);
CREATE INDEX IF NOT EXISTS idx_profiles_plano ON profiles(plano);
CREATE INDEX IF NOT EXISTS idx_iptv_channels_health ON iptv_channels(is_healthy, health_score);
CREATE INDEX IF NOT EXISTS idx_iptv_channels_content_type ON iptv_channels(content_type);
CREATE INDEX IF NOT EXISTS idx_payments_created_status ON payments(created_at, status);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled ON notification_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viewing_history_user_watched ON user_viewing_history(user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_viewing_history_channel_watched ON user_viewing_history(channel_id, watched_at DESC);

-- 12. Helper functions
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS TABLE(
  total_users bigint,
  active_users bigint,
  trial_users bigint,
  expired_users bigint,
  expiring_soon bigint,
  total_channels bigint,
  healthy_channels bigint,
  total_categories bigint,
  total_series bigint,
  approved_payments bigint,
  monthly_revenue numeric,
  last_refresh timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM mv_dashboard_summary LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_channel_stats_by_category()
RETURNS TABLE(
  category text,
  channel_count bigint,
  healthy_count bigint,
  unhealthy_count bigint,
  avg_health_score numeric,
  series_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM mv_channel_health_summary ORDER BY channel_count DESC;
$$;
