-- Fix SECURITY DEFINER views by switching to SECURITY INVOKER (recommended)

CREATE OR REPLACE VIEW public.v_activity_logs
WITH (security_invoker=on)
AS
SELECT
  id,
  user_id,
  action,
  entity_type,
  entity_id,
  details,
  ip_address,
  created_at
FROM public.activity_logs
UNION ALL
SELECT
  id,
  user_id,
  action,
  entity_type,
  entity_id,
  details,
  ip_address,
  created_at
FROM public.activity_logs_partitioned;

CREATE OR REPLACE VIEW public.v_channel_categories
WITH (security_invoker=on)
AS
SELECT
  ic.category,
  count(*) AS total,
  count(*) FILTER (WHERE ic.is_healthy = true) AS healthy,
  count(*) FILTER (WHERE ic.is_series = true) AS series
FROM public.iptv_channels ic
WHERE ic.category IS NOT NULL
GROUP BY ic.category
ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public.v_origin_statistics
WITH (security_invoker=on)
AS
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
    WHEN health_score >= 90 THEN 'excellent'::text
    WHEN health_score >= 70 THEN 'good'::text
    WHEN health_score >= 50 THEN 'fair'::text
    WHEN health_score >= 30 THEN 'poor'::text
    ELSE 'critical'::text
  END AS health_status
FROM public.iptv_origin_servers
ORDER BY health_score DESC;

CREATE OR REPLACE VIEW public.v_pending_notifications
WITH (security_invoker=on)
AS
SELECT
  nq.id,
  nq.recipient_phone,
  nq.recipient_name,
  nq.message_content,
  nq.status,
  nq.scheduled_at,
  nq.created_at
FROM public.notification_queue nq
WHERE nq.status = 'pending'::text
ORDER BY nq.scheduled_at;

CREATE OR REPLACE VIEW public.v_user_profile_summary
WITH (security_invoker=on)
AS
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
    WHEN p.data_vencimento IS NULL THEN 'unknown'::text
    WHEN p.data_vencimento < now() THEN 'expired'::text
    WHEN p.data_vencimento < (now() + '3 days'::interval) THEN 'expiring'::text
    ELSE 'active'::text
  END AS subscription_status
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;