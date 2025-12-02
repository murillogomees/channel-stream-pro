-- Grant admin + master full access to security-related tables for /admin/security dashboards

-- Helper comment: relies on existing is_admin_or_master(auth.uid()) function

-- 1) Authentication session logs
CREATE POLICY "Admins and masters full access auth_sessions_log"
ON public.auth_sessions_log
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- 2) Security events
CREATE POLICY "Admins and masters full access security_events"
ON public.security_events
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- 3) IP blacklist
CREATE POLICY "Admins and masters full access ip_blacklist"
ON public.ip_blacklist
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- 4) IP whitelist
CREATE POLICY "Admins and masters full access ip_whitelist"
ON public.ip_whitelist
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- 5) Security alert config
CREATE POLICY "Admins and masters full access security_alert_config"
ON public.security_alert_config
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- 6) Security alert templates
CREATE POLICY "Admins and masters full access security_alert_templates"
ON public.security_alert_templates
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- 7) Security alert escalation rules (if table exists)
DO $$
BEGIN
  IF to_regclass('public.security_alert_escalation_rules') IS NOT NULL THEN
    CREATE POLICY "Admins and masters full access security_alert_escalation_rules"
    ON public.security_alert_escalation_rules
    FOR ALL
    USING (is_admin_or_master(auth.uid()));
  END IF;
END $$;