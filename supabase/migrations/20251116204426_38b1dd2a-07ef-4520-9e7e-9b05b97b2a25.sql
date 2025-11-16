-- Create IP blacklist table
CREATE TABLE IF NOT EXISTS public.ip_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low', 'medium', 'high'
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_by UUID,  -- Admin who blocked (NULL if auto-blocked)
  auto_blocked BOOLEAN DEFAULT false,
  failed_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- NULL = permanent
  notes TEXT,
  unblocked_at TIMESTAMPTZ,
  unblocked_by UUID
);

-- Enable RLS
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage IP blacklist"
  ON public.ip_blacklist
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert (for auto-blocking)
-- Already covered by service role bypass

-- Indexes
CREATE INDEX idx_ip_blacklist_ip ON public.ip_blacklist(ip_address);
CREATE INDEX idx_ip_blacklist_expires ON public.ip_blacklist(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ip_blacklist_active ON public.ip_blacklist(blocked_at) WHERE unblocked_at IS NULL;

-- Create security alert configuration table
CREATE TABLE IF NOT EXISTS public.security_alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  event_type TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 5,
  time_window_minutes INTEGER NOT NULL DEFAULT 60,
  severity_level TEXT NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'critical'
  notification_channels JSONB DEFAULT '["whatsapp"]'::jsonb,  -- ['whatsapp', 'email', 'database']
  recipient_admin_ids UUID[],  -- NULL = all admins
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_alert_config ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage alert config"
  ON public.security_alert_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default alert configurations
INSERT INTO public.security_alert_config (alert_name, event_type, threshold, time_window_minutes, severity_level) VALUES
  ('Multiple Failed Logins', 'failed_login', 5, 15, 'critical'),
  ('Suspicious Activity Spike', 'suspicious_activity', 3, 10, 'critical'),
  ('Rate Limit Violations', 'rate_limit_exceeded', 10, 60, 'warning'),
  ('Unauthorized Access Attempts', 'unauthorized_access', 3, 30, 'warning'),
  ('Permission Changes', 'permission_change', 1, 1, 'warning')
ON CONFLICT (alert_name) DO NOTHING;

-- Function to check and auto-block IPs
CREATE OR REPLACE FUNCTION public.check_and_block_ip(
  _ip_address TEXT,
  _event_type TEXT,
  _threshold INTEGER DEFAULT 5,
  _window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_already_blocked BOOLEAN;
BEGIN
  -- Check if IP is already blocked
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blacklist
    WHERE ip_address = _ip_address
      AND unblocked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_already_blocked;

  IF v_already_blocked THEN
    RETURN true;
  END IF;

  -- Count recent events from this IP
  SELECT COUNT(*) INTO v_count
  FROM public.security_events
  WHERE ip_address = _ip_address
    AND event_type = _event_type
    AND created_at > now() - (_window_minutes || ' minutes')::interval;

  -- Auto-block if threshold exceeded
  IF v_count >= _threshold THEN
    INSERT INTO public.ip_blacklist (
      ip_address,
      reason,
      severity,
      auto_blocked,
      failed_attempts,
      last_attempt_at,
      expires_at
    ) VALUES (
      _ip_address,
      format('Auto-blocked: %s %s events in %s minutes', v_count, _event_type, _window_minutes),
      CASE WHEN _event_type = 'failed_login' THEN 'high' ELSE 'medium' END,
      true,
      v_count,
      now(),
      now() + interval '24 hours'  -- 24-hour auto-ban
    )
    ON CONFLICT (ip_address) 
    DO UPDATE SET
      failed_attempts = ip_blacklist.failed_attempts + 1,
      last_attempt_at = now(),
      expires_at = now() + interval '24 hours';

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Function to get security analytics
CREATE OR REPLACE FUNCTION public.get_security_analytics(
  _days INTEGER DEFAULT 7
)
RETURNS TABLE (
  date DATE,
  total_events BIGINT,
  failed_logins BIGINT,
  suspicious_activities BIGINT,
  rate_limit_exceeded BIGINT,
  unauthorized_access BIGINT,
  permission_changes BIGINT,
  critical_count BIGINT,
  warning_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_type = 'failed_login') as failed_logins,
    COUNT(*) FILTER (WHERE event_type = 'suspicious_activity') as suspicious_activities,
    COUNT(*) FILTER (WHERE event_type = 'rate_limit_exceeded') as rate_limit_exceeded,
    COUNT(*) FILTER (WHERE event_type = 'unauthorized_access') as unauthorized_access,
    COUNT(*) FILTER (WHERE event_type = 'permission_change') as permission_changes,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE severity = 'warning') as warning_count
  FROM public.security_events
  WHERE created_at > now() - (_days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$;

-- Function to get top threat IPs
CREATE OR REPLACE FUNCTION public.get_top_threat_ips(
  _limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  ip_address TEXT,
  event_count BIGINT,
  failed_logins BIGINT,
  suspicious_activities BIGINT,
  is_blocked BOOLEAN,
  last_event TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    se.ip_address,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE se.event_type = 'failed_login') as failed_logins,
    COUNT(*) FILTER (WHERE se.event_type = 'suspicious_activity') as suspicious_activities,
    EXISTS(
      SELECT 1 FROM public.ip_blacklist bl
      WHERE bl.ip_address = se.ip_address
        AND bl.unblocked_at IS NULL
        AND (bl.expires_at IS NULL OR bl.expires_at > now())
    ) as is_blocked,
    MAX(se.created_at) as last_event
  FROM public.security_events se
  WHERE se.ip_address IS NOT NULL
    AND se.created_at > now() - interval '7 days'
  GROUP BY se.ip_address
  ORDER BY event_count DESC
  LIMIT _limit;
$$;