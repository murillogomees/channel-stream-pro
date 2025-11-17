-- Adicionar campos de ação e métricas à tabela security_alert_deliveries
ALTER TABLE public.security_alert_deliveries
ADD COLUMN IF NOT EXISTS action_taken text,
ADD COLUMN IF NOT EXISTS action_taken_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS action_notes text,
ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivery_latency_ms integer,
ADD COLUMN IF NOT EXISTS read_latency_ms integer,
ADD COLUMN IF NOT EXISTS confirmation_latency_ms integer;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_security_alert_deliveries_status ON public.security_alert_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_security_alert_deliveries_admin ON public.security_alert_deliveries(admin_phone_id);
CREATE INDEX IF NOT EXISTS idx_security_alert_deliveries_event ON public.security_alert_deliveries(security_event_id);
CREATE INDEX IF NOT EXISTS idx_security_alert_deliveries_sent_at ON public.security_alert_deliveries(sent_at DESC);

-- Função para calcular estatísticas de performance dos alertas
CREATE OR REPLACE FUNCTION public.get_alert_performance_stats(
  _days integer DEFAULT 30
)
RETURNS TABLE(
  total_alerts bigint,
  confirmed_alerts bigint,
  confirmation_rate numeric,
  avg_read_time_minutes numeric,
  avg_confirmation_time_minutes numeric,
  total_escalations bigint,
  escalation_rate numeric
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*)::bigint as total_alerts,
    COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL)::bigint as confirmed_alerts,
    ROUND(
      (COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 
      2
    ) as confirmation_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (read_at - sent_at)) / 60) FILTER (WHERE read_at IS NOT NULL),
      2
    ) as avg_read_time_minutes,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (confirmed_at - sent_at)) / 60) FILTER (WHERE confirmed_at IS NOT NULL),
      2
    ) as avg_confirmation_time_minutes,
    COUNT(*) FILTER (WHERE escalated = true)::bigint as total_escalations,
    ROUND(
      (COUNT(*) FILTER (WHERE escalated = true)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100,
      2
    ) as escalation_rate
  FROM public.security_alert_deliveries
  WHERE sent_at > now() - (_days || ' days')::interval;
$$;

-- Função para estatísticas por admin
CREATE OR REPLACE FUNCTION public.get_admin_performance_stats(
  _days integer DEFAULT 30
)
RETURNS TABLE(
  admin_id uuid,
  admin_name text,
  admin_phone text,
  total_alerts bigint,
  confirmed_alerts bigint,
  confirmation_rate numeric,
  avg_response_time_minutes numeric,
  alerts_with_action bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ap.id as admin_id,
    ap.name as admin_name,
    ap.phone as admin_phone,
    COUNT(sad.id)::bigint as total_alerts,
    COUNT(sad.id) FILTER (WHERE sad.confirmed_at IS NOT NULL)::bigint as confirmed_alerts,
    ROUND(
      (COUNT(sad.id) FILTER (WHERE sad.confirmed_at IS NOT NULL)::numeric / NULLIF(COUNT(sad.id), 0)::numeric) * 100,
      2
    ) as confirmation_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (sad.confirmed_at - sad.sent_at)) / 60) FILTER (WHERE sad.confirmed_at IS NOT NULL),
      2
    ) as avg_response_time_minutes,
    COUNT(sad.id) FILTER (WHERE sad.action_taken IS NOT NULL)::bigint as alerts_with_action
  FROM public.admin_phones ap
  LEFT JOIN public.security_alert_deliveries sad ON ap.id = sad.admin_phone_id
  WHERE sad.sent_at IS NULL OR sad.sent_at > now() - (_days || ' days')::interval
  GROUP BY ap.id, ap.name, ap.phone
  ORDER BY confirmation_rate DESC NULLS LAST, avg_response_time_minutes ASC NULLS LAST;
$$;

-- Função para timeline de alertas
CREATE OR REPLACE FUNCTION public.get_alert_timeline(
  _hours integer DEFAULT 24,
  _limit integer DEFAULT 100
)
RETURNS TABLE(
  delivery_id uuid,
  event_id uuid,
  event_type text,
  severity text,
  admin_name text,
  admin_phone text,
  sent_at timestamp with time zone,
  read_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  escalated boolean,
  escalated_at timestamp with time zone,
  action_taken text,
  action_taken_at timestamp with time zone,
  delivery_status text,
  event_details jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sad.id as delivery_id,
    se.id as event_id,
    se.event_type,
    se.severity,
    ap.name as admin_name,
    ap.phone as admin_phone,
    sad.sent_at,
    sad.read_at,
    sad.confirmed_at,
    sad.escalated,
    sad.escalated_at,
    sad.action_taken,
    sad.action_taken_at,
    sad.delivery_status,
    se.event_details
  FROM public.security_alert_deliveries sad
  JOIN public.security_events se ON sad.security_event_id = se.id
  JOIN public.admin_phones ap ON sad.admin_phone_id = ap.id
  WHERE sad.sent_at > now() - (_hours || ' hours')::interval
  ORDER BY sad.sent_at DESC
  LIMIT _limit;
$$;