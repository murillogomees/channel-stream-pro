-- =====================================================
-- SCRIPT 14: CREATE ALL RLS POLICIES
-- Supabase Cloud Project: sdvyxdghxqmntyoweqbd
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_badge_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_dashboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_fraud_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_marketing_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptv_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin_or_master());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_admin_or_master());
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (is_admin_or_master());
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (is_admin_or_master());

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (is_admin_or_master());

-- Subscription plans - public read
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (is_admin_or_master());

-- AB Tests
CREATE POLICY "Admins can manage ab tests" ON public.ab_test_offers FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view active ab tests" ON public.ab_test_offers FOR SELECT USING (active = true);
CREATE POLICY "Admins can view ab results" ON public.ab_test_results FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Anyone can insert ab results" ON public.ab_test_results FOR INSERT WITH CHECK (true);

-- Account deletion
CREATE POLICY "Users can manage own deletion requests" ON public.account_deletion_requests FOR ALL USING (auth.uid() = user_id OR is_admin_or_master());

-- Activity logs
CREATE POLICY "Admins can view all activity" ON public.activity_logs FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert activity" ON public.activity_logs FOR INSERT WITH CHECK (true);

-- Admin features
CREATE POLICY "Users can manage own badge notifications" ON public.admin_badge_notifications FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Users can manage own favorites" ON public.admin_favorites FOR ALL USING (auth.uid() = admin_id);
CREATE POLICY "Admins can manage admin_phones" ON public.admin_phones FOR ALL USING (is_admin_or_master());
CREATE POLICY "Users can manage own shortcuts" ON public.admin_shortcuts FOR ALL USING (auth.uid() = user_id);

-- Affiliates
CREATE POLICY "Users can view own affiliate" ON public.affiliates FOR SELECT USING (auth.uid() = user_id OR is_admin_or_master());
CREATE POLICY "Admins can manage affiliates" ON public.affiliates FOR ALL USING (is_admin_or_master());

-- Affiliate analytics
CREATE POLICY "Admins can manage analytics" ON public.affiliate_analytics FOR ALL USING (is_admin_or_master());
CREATE POLICY "Affiliates can view own analytics" ON public.affiliate_analytics FOR SELECT 
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- Affiliate config
CREATE POLICY "Admins can manage config" ON public.affiliate_config FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view config" ON public.affiliate_config FOR SELECT USING (true);

-- Affiliate dashboard
CREATE POLICY "Affiliates can manage own dashboard" ON public.affiliate_dashboard FOR ALL 
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- Affiliate fraud logs
CREATE POLICY "Admins can manage fraud logs" ON public.affiliate_fraud_logs FOR ALL USING (is_admin_or_master());

-- Affiliate link clicks
CREATE POLICY "Admins can manage clicks" ON public.affiliate_link_clicks FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can insert clicks" ON public.affiliate_link_clicks FOR INSERT WITH CHECK (true);

-- Affiliate links
CREATE POLICY "Affiliates can manage own links" ON public.affiliate_links FOR ALL 
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()) OR is_admin_or_master());

-- Affiliate marketing materials
CREATE POLICY "Anyone can view materials" ON public.affiliate_marketing_materials FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage materials" ON public.affiliate_marketing_materials FOR ALL USING (is_admin_or_master());

-- Affiliate tiers
CREATE POLICY "Anyone can view tiers" ON public.affiliate_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can manage tiers" ON public.affiliate_tiers FOR ALL USING (is_admin_or_master());

-- Security events
CREATE POLICY "Admins can view security events" ON public.security_events FOR SELECT USING (is_admin_or_master());
CREATE POLICY "Anyone can insert security events" ON public.security_events FOR INSERT WITH CHECK (true);

-- IPTV channels
CREATE POLICY "Anyone can view channels" ON public.iptv_channels FOR SELECT USING (true);
CREATE POLICY "Admins can manage channels" ON public.iptv_channels FOR ALL USING (is_admin_or_master());

-- IPTV playlists
CREATE POLICY "Users can view own playlists" ON public.iptv_playlists FOR SELECT USING (user_id = auth.uid() OR is_public = true OR is_admin_or_master());
CREATE POLICY "Users can manage own playlists" ON public.iptv_playlists FOR ALL USING (user_id = auth.uid() OR is_admin_or_master());

-- Notification templates
CREATE POLICY "Admins can manage templates" ON public.notification_templates FOR ALL USING (is_admin_or_master());
CREATE POLICY "Anyone can view templates" ON public.notification_templates FOR SELECT USING (is_active = true);

-- Payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (user_id = auth.uid() OR is_admin_or_master());
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (is_admin_or_master());
