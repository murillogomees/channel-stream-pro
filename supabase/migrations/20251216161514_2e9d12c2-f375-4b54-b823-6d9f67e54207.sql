-- =====================================================
-- ADD MISSING updated_at TRIGGERS
-- Using DROP + CREATE pattern since IF NOT EXISTS not supported for triggers
-- =====================================================

-- profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- subscription_plans
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- homepage_content
DROP TRIGGER IF EXISTS update_homepage_content_updated_at ON public.homepage_content;
CREATE TRIGGER update_homepage_content_updated_at
  BEFORE UPDATE ON public.homepage_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- homepage_faqs
DROP TRIGGER IF EXISTS update_homepage_faqs_updated_at ON public.homepage_faqs;
CREATE TRIGGER update_homepage_faqs_updated_at
  BEFORE UPDATE ON public.homepage_faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- feature_flag_config
DROP TRIGGER IF EXISTS update_feature_flag_config_updated_at ON public.feature_flag_config;
CREATE TRIGGER update_feature_flag_config_updated_at
  BEFORE UPDATE ON public.feature_flag_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- affiliates
DROP TRIGGER IF EXISTS update_affiliates_updated_at ON public.affiliates;
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- discount_coupons
DROP TRIGGER IF EXISTS update_discount_coupons_updated_at ON public.discount_coupons;
CREATE TRIGGER update_discount_coupons_updated_at
  BEFORE UPDATE ON public.discount_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_subscriptions
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pwa_settings
DROP TRIGGER IF EXISTS update_pwa_settings_updated_at ON public.pwa_settings;
CREATE TRIGGER update_pwa_settings_updated_at
  BEFORE UPDATE ON public.pwa_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mercado_pago_config
DROP TRIGGER IF EXISTS update_mercado_pago_config_updated_at ON public.mercado_pago_config;
CREATE TRIGGER update_mercado_pago_config_updated_at
  BEFORE UPDATE ON public.mercado_pago_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notification_templates
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON public.notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- iptv_origin_servers
DROP TRIGGER IF EXISTS update_iptv_origin_servers_updated_at ON public.iptv_origin_servers;
CREATE TRIGGER update_iptv_origin_servers_updated_at
  BEFORE UPDATE ON public.iptv_origin_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- iptv_llhls_config
DROP TRIGGER IF EXISTS update_iptv_llhls_config_updated_at ON public.iptv_llhls_config;
CREATE TRIGGER update_iptv_llhls_config_updated_at
  BEFORE UPDATE ON public.iptv_llhls_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ab_test_offers
DROP TRIGGER IF EXISTS update_ab_test_offers_updated_at ON public.ab_test_offers;
CREATE TRIGGER update_ab_test_offers_updated_at
  BEFORE UPDATE ON public.ab_test_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- affiliate_config
DROP TRIGGER IF EXISTS update_affiliate_config_updated_at ON public.affiliate_config;
CREATE TRIGGER update_affiliate_config_updated_at
  BEFORE UPDATE ON public.affiliate_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- system_config
DROP TRIGGER IF EXISTS update_system_config_updated_at ON public.system_config;
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- affiliate_dashboard
DROP TRIGGER IF EXISTS update_affiliate_dashboard_updated_at ON public.affiliate_dashboard;
CREATE TRIGGER update_affiliate_dashboard_updated_at
  BEFORE UPDATE ON public.affiliate_dashboard
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- affiliate_marketing_materials
DROP TRIGGER IF EXISTS update_affiliate_marketing_materials_updated_at ON public.affiliate_marketing_materials;
CREATE TRIGGER update_affiliate_marketing_materials_updated_at
  BEFORE UPDATE ON public.affiliate_marketing_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto_notifications
DROP TRIGGER IF EXISTS update_auto_notifications_updated_at ON public.auto_notifications;
CREATE TRIGGER update_auto_notifications_updated_at
  BEFORE UPDATE ON public.auto_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- dashboard_widgets
DROP TRIGGER IF EXISTS update_dashboard_widgets_updated_at ON public.dashboard_widgets;
CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- banners
DROP TRIGGER IF EXISTS update_banners_updated_at ON public.banners;
CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- m3u_sources
DROP TRIGGER IF EXISTS update_m3u_sources_updated_at ON public.m3u_sources;
CREATE TRIGGER update_m3u_sources_updated_at
  BEFORE UPDATE ON public.m3u_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ADD MISSING INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_situacao ON public.profiles(situacao);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_id ON public.notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);