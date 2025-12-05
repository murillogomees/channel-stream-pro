-- Final batch - remaining policies

-- security tables
DROP POLICY IF EXISTS "Admins can manage alert config" ON security_alert_config;
DROP POLICY IF EXISTS "Admins have full access to security_alert_config" ON security_alert_config;
CREATE POLICY "Admins and masters manage security_alert_config" ON security_alert_config FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to security_alert_deliveries" ON security_alert_deliveries;
DROP POLICY IF EXISTS "Admins podem ver entregas de alertas" ON security_alert_deliveries;
CREATE POLICY "Admins and masters manage security_alert_deliveries" ON security_alert_deliveries FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to security_alert_escalation_rules" ON security_alert_escalation_rules;
DROP POLICY IF EXISTS "Admins podem gerenciar regras de escalonamento" ON security_alert_escalation_rules;
CREATE POLICY "Admins and masters manage security_alert_escalation_rules" ON security_alert_escalation_rules FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to security_alert_templates" ON security_alert_templates;
DROP POLICY IF EXISTS "Admins podem gerenciar templates de alertas" ON security_alert_templates;
CREATE POLICY "Admins and masters manage security_alert_templates" ON security_alert_templates FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can update security events" ON security_events;
DROP POLICY IF EXISTS "Admins have full access to security_events" ON security_events;
CREATE POLICY "Admins and masters manage security_events" ON security_events FOR ALL USING (is_admin_or_master(auth.uid()));

-- other tables
DROP POLICY IF EXISTS "Admins podem visualizar histórico de status" ON status_change_history;
CREATE POLICY "Admins and masters manage status_change_history" ON status_change_history FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all stream analytics" ON stream_analytics;
CREATE POLICY "Admins and masters manage stream_analytics" ON stream_analytics FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admin can manage signing keys" ON stream_signing_keys;
CREATE POLICY "Admins and masters manage stream_signing_keys" ON stream_signing_keys FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admin can view streaming metrics" ON streaming_metrics;
CREATE POLICY "Admins and masters manage streaming_metrics" ON streaming_metrics FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admin can manage streaming policies" ON streaming_policies;
CREATE POLICY "Admins and masters manage streaming_policies" ON streaming_policies FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins podem gerenciar planos" ON subscription_plans;
CREATE POLICY "Admins and masters manage subscription_plans" ON subscription_plans FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to suspicious_login_attempts" ON suspicious_login_attempts;
DROP POLICY IF EXISTS "Admins podem visualizar tentativas suspeitas" ON suspicious_login_attempts;
CREATE POLICY "Admins and masters manage suspicious_login_attempts" ON suspicious_login_attempts FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can view job history" ON transcode_job_history;
CREATE POLICY "Admins and masters manage transcode_job_history" ON transcode_job_history FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage transcode jobs" ON transcode_jobs;
DROP POLICY IF EXISTS "Admins can view all transcode jobs" ON transcode_jobs;
CREATE POLICY "Admins and masters manage transcode_jobs" ON transcode_jobs FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage trending" ON trending_rankings;
CREATE POLICY "Admins and masters manage trending_rankings" ON trending_rankings FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can view behavior tracking" ON trial_behavior_tracking;
CREATE POLICY "Admins and masters manage trial_behavior_tracking" ON trial_behavior_tracking FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to subscriptions" ON user_subscriptions;
CREATE POLICY "Admins and masters manage user_subscriptions" ON user_subscriptions FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins full access vod_host_status" ON vod_host_status;
CREATE POLICY "Admins and masters manage vod_host_status" ON vod_host_status FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON whatsapp_templates;
CREATE POLICY "Admins and masters manage whatsapp_templates" ON whatsapp_templates FOR ALL USING (is_admin_or_master(auth.uid()));