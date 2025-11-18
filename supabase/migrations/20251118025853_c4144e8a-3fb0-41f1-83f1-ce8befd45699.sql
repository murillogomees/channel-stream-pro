
-- Corrigir todas as RLS policies para permitir acesso admin completo

-- ============================================
-- PROFILES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- CLIENTES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own cliente data" ON clientes;
DROP POLICY IF EXISTS "Admins can view all clientes" ON clientes;
DROP POLICY IF EXISTS "Admins can insert clientes" ON clientes;
DROP POLICY IF EXISTS "Admins can update clientes" ON clientes;
DROP POLICY IF EXISTS "Admins can delete clientes" ON clientes;

CREATE POLICY "Users can view own cliente data" ON clientes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to clientes" ON clientes
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- USER_ROLES TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;

CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to user_roles" ON user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- M3U_LISTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view all m3u lists" ON m3u_lists;
DROP POLICY IF EXISTS "Admins can manage m3u lists" ON m3u_lists;

CREATE POLICY "Admins have full access to m3u_lists" ON m3u_lists
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- CLIENT_M3U_LISTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own m3u assignments" ON client_m3u_lists;
DROP POLICY IF EXISTS "Admins can view all assignments" ON client_m3u_lists;
DROP POLICY IF EXISTS "Admins can manage assignments" ON client_m3u_lists;

CREATE POLICY "Users can view own m3u assignments" ON client_m3u_lists
  FOR SELECT USING (
    client_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins have full access to client_m3u_lists" ON client_m3u_lists
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- ADMIN_PHONES TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view admin phones" ON admin_phones;
DROP POLICY IF EXISTS "Admins can manage admin phones" ON admin_phones;

CREATE POLICY "Admins have full access to admin_phones" ON admin_phones
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- NOTIFICATION_TEMPLATES TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can view templates" ON notification_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON notification_templates;

CREATE POLICY "Admins have full access to notification_templates" ON notification_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- NOTIFICATION_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Admins can view all notification logs" ON notification_logs;

CREATE POLICY "Users can view own notification logs" ON notification_logs
  FOR SELECT USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins have full access to notification_logs" ON notification_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- AUTOMATIC_NOTIFICATION_RULES TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins can manage notification rules" ON automatic_notification_rules;

CREATE POLICY "Admins have full access to automatic_notification_rules" ON automatic_notification_rules
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- ACTIVITY_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can view own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity logs" ON activity_logs;

CREATE POLICY "Users can view own activity logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to activity_logs" ON activity_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- ADMIN_SHORTCUTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Users can manage own shortcuts" ON admin_shortcuts;
DROP POLICY IF EXISTS "Admins can view all shortcuts" ON admin_shortcuts;

CREATE POLICY "Users can manage own shortcuts" ON admin_shortcuts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to admin_shortcuts" ON admin_shortcuts
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- SECURITY TABLES
-- ============================================
DROP POLICY IF EXISTS "Admins can view security events" ON security_events;
CREATE POLICY "Admins have full access to security_events" ON security_events
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view ip blacklist" ON ip_blacklist;
CREATE POLICY "Admins have full access to ip_blacklist" ON ip_blacklist
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view ip whitelist" ON ip_whitelist;
CREATE POLICY "Admins have full access to ip_whitelist" ON ip_whitelist
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- METRICS AND HEALTH TABLES
-- ============================================
DROP POLICY IF EXISTS "Admins can view metrics" ON metrics_snapshots;
CREATE POLICY "Admins have full access to metrics_snapshots" ON metrics_snapshots
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view health" ON health_snapshots;
CREATE POLICY "Admins have full access to health_snapshots" ON health_snapshots
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view playlist health" ON playlist_health_checks;
CREATE POLICY "Admins have full access to playlist_health_checks" ON playlist_health_checks
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- ADMIN BADGE AND LEADERBOARD TABLES
-- ============================================
DROP POLICY IF EXISTS "Admins can view badges" ON admin_badge_notifications;
CREATE POLICY "Admins have full access to admin_badge_notifications" ON admin_badge_notifications
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view leaderboard" ON admin_leaderboard_history;
CREATE POLICY "Admins have full access to admin_leaderboard_history" ON admin_leaderboard_history
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- SECURITY ALERT TABLES
-- ============================================
DROP POLICY IF EXISTS "Admins manage security alert config" ON security_alert_config;
CREATE POLICY "Admins have full access to security_alert_config" ON security_alert_config
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view alert deliveries" ON security_alert_deliveries;
CREATE POLICY "Admins have full access to security_alert_deliveries" ON security_alert_deliveries
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage escalation rules" ON security_alert_escalation_rules;
CREATE POLICY "Admins have full access to security_alert_escalation_rules" ON security_alert_escalation_rules
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage alert templates" ON security_alert_templates;
CREATE POLICY "Admins have full access to security_alert_templates" ON security_alert_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- SUSPICIOUS LOGIN ATTEMPTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Admins view suspicious logins" ON suspicious_login_attempts;
CREATE POLICY "Admins have full access to suspicious_login_attempts" ON suspicious_login_attempts
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- AUTH SESSIONS LOG TABLE
-- ============================================
DROP POLICY IF EXISTS "Users view own sessions" ON auth_sessions_log;
DROP POLICY IF EXISTS "Admins view all sessions" ON auth_sessions_log;

CREATE POLICY "Users view own sessions" ON auth_sessions_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to auth_sessions_log" ON auth_sessions_log
  FOR ALL USING (has_role(auth.uid(), 'admin'));
