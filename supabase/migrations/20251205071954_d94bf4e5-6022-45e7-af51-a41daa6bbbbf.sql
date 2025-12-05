-- Fix all RLS policies to include master role access
-- This migration updates all admin-only policies to use is_admin_or_master()

-- ab_test_offers
DROP POLICY IF EXISTS "Admins can manage A/B tests" ON ab_test_offers;
CREATE POLICY "Admins and masters can manage A/B tests" ON ab_test_offers FOR ALL USING (is_admin_or_master(auth.uid()));

-- ab_test_results
DROP POLICY IF EXISTS "Admins can view A/B test results" ON ab_test_results;
CREATE POLICY "Admins and masters can view A/B test results" ON ab_test_results FOR SELECT USING (is_admin_or_master(auth.uid()));

-- activity_logs (remove duplicates, keep one)
DROP POLICY IF EXISTS "Admins have full access to activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins podem visualizar logs" ON activity_logs;

-- admin_badge_notifications (remove duplicates)
DROP POLICY IF EXISTS "Admins have full access to admin_badge_notifications" ON admin_badge_notifications;
DROP POLICY IF EXISTS "Admins podem marcar como lido" ON admin_badge_notifications;
DROP POLICY IF EXISTS "Admins podem ver suas notificações" ON admin_badge_notifications;

-- admin_phones (remove duplicates)
DROP POLICY IF EXISTS "Admins have full access to admin_phones" ON admin_phones;
DROP POLICY IF EXISTS "Admins podem gerenciar telefones" ON admin_phones;

-- admin_shortcuts (remove duplicates)
DROP POLICY IF EXISTS "Admins have full access to admin_shortcuts" ON admin_shortcuts;
DROP POLICY IF EXISTS "Admins podem gerenciar atalhos" ON admin_shortcuts;

-- affiliate tables
DROP POLICY IF EXISTS "Admins can manage analytics" ON affiliate_analytics;
CREATE POLICY "Admins and masters can manage analytics" ON affiliate_analytics FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage config" ON affiliate_config;
CREATE POLICY "Admins and masters can manage config" ON affiliate_config FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage fraud logs" ON affiliate_fraud_logs;
CREATE POLICY "Admins and masters can manage fraud logs" ON affiliate_fraud_logs FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all clicks" ON affiliate_link_clicks;
CREATE POLICY "Admins and masters can view all clicks" ON affiliate_link_clicks FOR SELECT USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage materials" ON affiliate_marketing_materials;
CREATE POLICY "Admins and masters can manage materials" ON affiliate_marketing_materials FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage plan commissions" ON affiliate_plan_commissions;
CREATE POLICY "Admins and masters can manage plan commissions" ON affiliate_plan_commissions FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all referrals" ON affiliate_referrals;
CREATE POLICY "Admins and masters can manage all referrals" ON affiliate_referrals FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tiers" ON affiliate_tiers;
CREATE POLICY "Admins and masters can manage tiers" ON affiliate_tiers FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON affiliate_withdrawals;
CREATE POLICY "Admins and masters can manage all withdrawals" ON affiliate_withdrawals FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all affiliates" ON affiliates;
CREATE POLICY "Admins and masters can manage all affiliates" ON affiliates FOR ALL USING (is_admin_or_master(auth.uid()));

-- auth_sessions_log (remove duplicates)
DROP POLICY IF EXISTS "Admins have full access to auth_sessions_log" ON auth_sessions_log;
DROP POLICY IF EXISTS "Admins podem visualizar logs de autenticação" ON auth_sessions_log;

-- auto_notification_config
DROP POLICY IF EXISTS "Admins podem gerenciar auto config" ON auto_notification_config;

-- automatic_notification_rules (remove duplicates)
DROP POLICY IF EXISTS "Admins have full access to automatic_notification_rules" ON automatic_notification_rules;
DROP POLICY IF EXISTS "Admins podem gerenciar regras de notificação" ON automatic_notification_rules;

-- cdn tables
DROP POLICY IF EXISTS "Admins can manage prewarm jobs" ON cdn_prewarm_jobs;
CREATE POLICY "Admins and masters can manage prewarm jobs" ON cdn_prewarm_jobs FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage predictions" ON cdn_prewarm_predictions;
CREATE POLICY "Admins and masters can manage predictions" ON cdn_prewarm_predictions FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage rate limits" ON cdn_rate_limits;
CREATE POLICY "Admins and masters can manage rate limits" ON cdn_rate_limits FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage CDN tokens" ON cdn_signed_tokens;
CREATE POLICY "Admins and masters can manage CDN tokens" ON cdn_signed_tokens FOR ALL USING (is_admin_or_master(auth.uid()));

-- channel_routing_overrides
DROP POLICY IF EXISTS "Admin can manage routing overrides" ON channel_routing_overrides;
CREATE POLICY "Admins and masters can manage routing overrides" ON channel_routing_overrides FOR ALL USING (is_admin_or_master(auth.uid()));

-- cf_stream_uploads (already fixed but ensure)
DROP POLICY IF EXISTS "Admins can manage stream uploads" ON cf_stream_uploads;

-- client_m3u tables
DROP POLICY IF EXISTS "Admins full access client_m3u_custom_assignments" ON client_m3u_custom_assignments;
CREATE POLICY "Admins and masters full access client_m3u_custom_assignments" ON client_m3u_custom_assignments FOR ALL USING (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to client_m3u_lists" ON client_m3u_lists;
DROP POLICY IF EXISTS "Admins podem gerenciar atribuições de M3U" ON client_m3u_lists;
CREATE POLICY "Admins and masters full access client_m3u_lists" ON client_m3u_lists FOR ALL USING (is_admin_or_master(auth.uid()));

-- clientes (remove duplicates)
DROP POLICY IF EXISTS "Admins have full access to clientes" ON clientes;
DROP POLICY IF EXISTS "Admins podem gerenciar clientes" ON clientes;
CREATE POLICY "Admins and masters full access clientes" ON clientes FOR ALL USING (is_admin_or_master(auth.uid()));

-- code_snippets
DROP POLICY IF EXISTS "Admins podem gerenciar code snippets" ON code_snippets;
CREATE POLICY "Admins and masters can manage code snippets" ON code_snippets FOR ALL USING (is_admin_or_master(auth.uid()));