
-- =====================================================
-- Recreate missing tables for services
-- =====================================================

-- 1. trending_rankings table (for predictiveCacheEngine)
CREATE TABLE IF NOT EXISTS public.trending_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  content_type TEXT,
  rank_position INTEGER,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trending_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trending_rankings" ON public.trending_rankings
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Anyone can view trending_rankings" ON public.trending_rankings
  FOR SELECT USING (true);

-- 2. watch_progress table (for predictiveCacheEngine and resumeService)
CREATE TABLE IF NOT EXISTS public.watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT,
  progress_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own watch_progress" ON public.watch_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all watch_progress" ON public.watch_progress
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

-- 3. status_change_history table (for criticalStatusAlertService)
CREATE TABLE IF NOT EXISTS public.status_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.status_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage status_change_history" ON public.status_change_history
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 4. rls_scan_results table (for rlsCoverageService)
CREATE TABLE IF NOT EXISTS public.rls_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  has_rls BOOLEAN DEFAULT false,
  policy_count INTEGER DEFAULT 0,
  issues JSONB,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rls_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rls_scan_results" ON public.rls_scan_results
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 5. rls_fix_backups table (for rlsCoverageService)
CREATE TABLE IF NOT EXISTS public.rls_fix_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  fix_type TEXT,
  original_sql TEXT,
  restore_sql TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rls_fix_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rls_fix_backups" ON public.rls_fix_backups
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 6. security_alert_deliveries table (for securityWhatsAppAlertService)
CREATE TABLE IF NOT EXISTS public.security_alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_phone TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT false,
  action_taken TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.security_alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage security_alert_deliveries" ON public.security_alert_deliveries
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 7. admin_phones table (for notification services)
CREATE TABLE IF NOT EXISTS public.admin_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin_phones" ON public.admin_phones
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 8. whatsapp_config table (for notification ConfigManager)
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key TEXT,
  auth_key TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_config" ON public.whatsapp_config
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 9. two_factor_auth table (for twoFactorAuthService)
CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes JSONB,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own 2FA" ON public.two_factor_auth
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all 2FA" ON public.two_factor_auth
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

-- 10. notification_logs table (for notification services)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID,
  recipient_phone TEXT,
  template_key TEXT,
  message_content TEXT,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification_logs" ON public.notification_logs
  FOR ALL USING (public.is_admin_or_master(auth.uid()));

-- 11. playback_tokens table (for playbackTokenService)
CREATE TABLE IF NOT EXISTS public.playback_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  content_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.playback_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own playback_tokens" ON public.playback_tokens
  FOR ALL USING (auth.uid() = user_id);

-- 12. player_events table (for playerEventsService)
CREATE TABLE IF NOT EXISTS public.player_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  content_id TEXT,
  content_type TEXT,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.player_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own player_events" ON public.player_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all player_events" ON public.player_events
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trending_rankings_content ON public.trending_rankings(content_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_user ON public.watch_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_content ON public.watch_progress(content_id);
CREATE INDEX IF NOT EXISTS idx_status_change_history_service ON public.status_change_history(service_name);
CREATE INDEX IF NOT EXISTS idx_security_alert_deliveries_alert ON public.security_alert_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_playback_tokens_token ON public.playback_tokens(token);
CREATE INDEX IF NOT EXISTS idx_player_events_user ON public.player_events(user_id);
CREATE INDEX IF NOT EXISTS idx_player_events_session ON public.player_events(session_id);

-- Add updated_at triggers
CREATE TRIGGER update_trending_rankings_updated_at
  BEFORE UPDATE ON public.trending_rankings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_watch_progress_updated_at
  BEFORE UPDATE ON public.watch_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_phones_updated_at
  BEFORE UPDATE ON public.admin_phones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_two_factor_auth_updated_at
  BEFORE UPDATE ON public.two_factor_auth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
