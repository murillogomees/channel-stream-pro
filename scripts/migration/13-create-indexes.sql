-- =====================================================
-- SCRIPT 13: CREATE ALL INDEXES
-- Source: Lovable Cloud (waxgowafohlrfoefwhsf)
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- =====================================================

-- Performance indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_situacao ON public.profiles(situacao);
CREATE INDEX idx_profiles_cliente_ativo ON public.profiles(cliente_ativo);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX idx_iptv_channels_category ON public.iptv_channels(category);
CREATE INDEX idx_iptv_channels_is_healthy ON public.iptv_channels(is_healthy);
CREATE INDEX idx_iptv_channels_series_name ON public.iptv_channels(series_name);
CREATE INDEX idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled ON public.notification_queue(scheduled_for);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
