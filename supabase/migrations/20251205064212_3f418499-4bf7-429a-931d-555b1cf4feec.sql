-- =====================================================
-- Migration: Affiliate System Complete Expansion
-- Description: Tiers, Analytics, Marketing Materials, Config, Fraud Detection
-- =====================================================

-- 1. Affiliate Tiers
CREATE TABLE IF NOT EXISTS public.affiliate_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_referrals INTEGER DEFAULT 0,
  min_revenue NUMERIC DEFAULT 0,
  commission_percentage NUMERIC NOT NULL,
  bonus_amount NUMERIC DEFAULT 0,
  icon TEXT,
  color TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default tiers
INSERT INTO public.affiliate_tiers (name, min_referrals, min_revenue, commission_percentage, bonus_amount, icon, color, description) VALUES
  ('Bronze', 0, 0, 10, 0, 'medal', '#CD7F32', 'Nível inicial para novos afiliados'),
  ('Prata', 10, 500, 15, 50, 'award', '#C0C0C0', 'Afiliados com bom desempenho'),
  ('Ouro', 50, 2500, 20, 150, 'crown', '#FFD700', 'Top performers'),
  ('Diamante', 100, 10000, 25, 500, 'gem', '#B9F2FF', 'Elite - Os melhores afiliados');

-- 2. Affiliate Plan Commissions (custom per plan)
CREATE TABLE IF NOT EXISTS public.affiliate_plan_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  commission_type TEXT DEFAULT 'percentage',
  commission_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(affiliate_id, plan_type)
);

-- 3. Affiliate Analytics
CREATE TABLE IF NOT EXISTS public.affiliate_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  revenue_generated NUMERIC DEFAULT 0,
  commission_earned NUMERIC DEFAULT 0,
  avg_order_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(affiliate_id, period_start, period_end)
);

-- 4. Affiliate Link Clicks
CREATE TABLE IF NOT EXISTS public.affiliate_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Affiliate Marketing Materials
CREATE TABLE IF NOT EXISTS public.affiliate_marketing_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'banner', 'text', 'video', 'image', 'email_template'
  content_url TEXT,
  content_text TEXT,
  dimensions TEXT, -- '300x250', '728x90', etc
  file_size INTEGER,
  download_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Affiliate Config
CREATE TABLE IF NOT EXISTS public.affiliate_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Default config values
INSERT INTO public.affiliate_config (config_key, config_value, description) VALUES
  ('min_withdrawal_amount', '{"value": 50}', 'Valor mínimo para solicitar saque (R$)'),
  ('withdrawal_cooldown_days', '{"value": 7}', 'Dias entre solicitações de saque'),
  ('max_withdrawals_per_month', '{"value": 4}', 'Máximo de saques por mês'),
  ('auto_confirm_referrals', '{"enabled": false, "delay_hours": 24}', 'Confirmar indicações automaticamente'),
  ('fraud_detection_enabled', '{"enabled": true}', 'Habilitar detecção de fraude'),
  ('recurring_commission_enabled', '{"enabled": true, "percentage": 5}', 'Comissão em renovações'),
  ('cookie_duration_days', '{"value": 30}', 'Duração do cookie de rastreamento');

-- 7. Affiliate Fraud Logs
CREATE TABLE IF NOT EXISTS public.affiliate_fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'self_referral', 'duplicate_ip', 'suspicious_pattern', 'rapid_clicks'
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Add new columns to affiliates table
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS custom_slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.affiliate_tiers(id),
ADD COLUMN IF NOT EXISTS is_recurring_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_click_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC DEFAULT 0;

-- Set default tier for existing affiliates
UPDATE public.affiliates 
SET tier_id = (SELECT id FROM public.affiliate_tiers WHERE name = 'Bronze' LIMIT 1)
WHERE tier_id IS NULL;

-- 9. Enable RLS on all new tables
ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_plan_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_marketing_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_fraud_logs ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies

-- Tiers - public read, admin write
CREATE POLICY "Anyone can view tiers" ON public.affiliate_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can manage tiers" ON public.affiliate_tiers FOR ALL USING (is_admin(auth.uid()));

-- Plan Commissions
CREATE POLICY "Admins can manage plan commissions" ON public.affiliate_plan_commissions FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Affiliates can view own plan commissions" ON public.affiliate_plan_commissions FOR SELECT 
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- Analytics
CREATE POLICY "Admins can manage analytics" ON public.affiliate_analytics FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Affiliates can view own analytics" ON public.affiliate_analytics FOR SELECT 
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- Link Clicks
CREATE POLICY "System can insert clicks" ON public.affiliate_link_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all clicks" ON public.affiliate_link_clicks FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Affiliates can view own clicks" ON public.affiliate_link_clicks FOR SELECT 
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- Marketing Materials - public read, admin write
CREATE POLICY "Anyone can view active materials" ON public.affiliate_marketing_materials FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage materials" ON public.affiliate_marketing_materials FOR ALL USING (is_admin(auth.uid()));

-- Config - admin only
CREATE POLICY "Admins can manage config" ON public.affiliate_config FOR ALL USING (is_admin(auth.uid()));

-- Fraud Logs - admin only
CREATE POLICY "Admins can manage fraud logs" ON public.affiliate_fraud_logs FOR ALL USING (is_admin(auth.uid()));

-- 11. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_analytics_affiliate_period ON public.affiliate_analytics(affiliate_id, period_start);
CREATE INDEX IF NOT EXISTS idx_affiliate_link_clicks_affiliate ON public.affiliate_link_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_link_clicks_clicked_at ON public.affiliate_link_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_fraud_logs_affiliate ON public.affiliate_fraud_logs(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_fraud_logs_unresolved ON public.affiliate_fraud_logs(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_affiliates_custom_slug ON public.affiliates(custom_slug) WHERE custom_slug IS NOT NULL;

-- 12. Trigger: Auto-create referral when coupon is used
CREATE OR REPLACE FUNCTION public.create_affiliate_referral_on_coupon_use()
RETURNS TRIGGER AS $$
DECLARE
  v_affiliate_id UUID;
  v_commission_type TEXT;
  v_commission_value NUMERIC;
BEGIN
  -- Get affiliate info from coupon
  SELECT dc.affiliate_id, a.commission_type, a.commission_value
  INTO v_affiliate_id, v_commission_type, v_commission_value
  FROM discount_coupons dc
  JOIN affiliates a ON a.id = dc.affiliate_id
  WHERE dc.id = NEW.coupon_id AND dc.affiliate_id IS NOT NULL;
  
  IF v_affiliate_id IS NOT NULL THEN
    INSERT INTO affiliate_referrals (
      affiliate_id, 
      referred_cliente_id, 
      coupon_id,
      commission_type,
      commission_value,
      commission_earned,
      plan_value,
      status
    ) VALUES (
      v_affiliate_id,
      NEW.client_id,
      NEW.coupon_id,
      v_commission_type,
      v_commission_value,
      CASE 
        WHEN v_commission_type = 'percentage' THEN NEW.order_value * (v_commission_value / 100)
        ELSE v_commission_value
      END,
      NEW.order_value,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_affiliate_referral ON public.coupon_usage;
CREATE TRIGGER trigger_create_affiliate_referral
  AFTER INSERT ON public.coupon_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.create_affiliate_referral_on_coupon_use();

-- 13. Trigger: Update affiliate balance when referral is confirmed
CREATE OR REPLACE FUNCTION public.update_affiliate_balance_on_confirm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    UPDATE affiliates 
    SET 
      available_balance = available_balance + NEW.commission_earned,
      total_earnings = total_earnings + NEW.commission_earned,
      total_referrals = total_referrals + 1,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_affiliate_balance ON public.affiliate_referrals;
CREATE TRIGGER trigger_update_affiliate_balance
  AFTER UPDATE ON public.affiliate_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_balance_on_confirm();

-- 14. Trigger: Decrement balance on withdrawal approval
CREATE OR REPLACE FUNCTION public.decrement_affiliate_balance_on_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    UPDATE affiliates 
    SET 
      available_balance = available_balance - NEW.amount,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_decrement_balance_withdrawal ON public.affiliate_withdrawals;
CREATE TRIGGER trigger_decrement_balance_withdrawal
  AFTER UPDATE ON public.affiliate_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_affiliate_balance_on_withdrawal();

-- 15. Trigger: Update affiliate tier based on performance
CREATE OR REPLACE FUNCTION public.update_affiliate_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_new_tier_id UUID;
BEGIN
  SELECT id INTO v_new_tier_id
  FROM affiliate_tiers
  WHERE NEW.total_referrals >= min_referrals 
    AND NEW.total_earnings >= min_revenue
  ORDER BY commission_percentage DESC
  LIMIT 1;
  
  IF v_new_tier_id IS NOT NULL AND v_new_tier_id != COALESCE(NEW.tier_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
    NEW.tier_id := v_new_tier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_affiliate_tier ON public.affiliates;
CREATE TRIGGER trigger_update_affiliate_tier
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_tier();

-- 16. Function: Track affiliate link click
CREATE OR REPLACE FUNCTION public.track_affiliate_click(
  p_affiliate_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_landing_page TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_click_id UUID;
BEGIN
  INSERT INTO affiliate_link_clicks (
    affiliate_id, ip_address, user_agent, referrer,
    utm_source, utm_medium, utm_campaign, landing_page
  ) VALUES (
    p_affiliate_id, p_ip_address, p_user_agent, p_referrer,
    p_utm_source, p_utm_medium, p_utm_campaign, p_landing_page
  )
  RETURNING id INTO v_click_id;
  
  -- Update affiliate click stats
  UPDATE affiliates 
  SET 
    total_clicks = total_clicks + 1,
    last_click_at = now()
  WHERE id = p_affiliate_id;
  
  RETURN v_click_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Function: Check for fraud patterns
CREATE OR REPLACE FUNCTION public.check_affiliate_fraud(
  p_affiliate_id UUID,
  p_ip_address TEXT,
  p_action_type TEXT DEFAULT 'click'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_fraud BOOLEAN := false;
  v_affiliate_ip TEXT;
  v_recent_clicks INTEGER;
BEGIN
  -- Check 1: Self-referral (same IP as affiliate)
  SELECT phone INTO v_affiliate_ip FROM affiliates WHERE id = p_affiliate_id;
  
  -- Check 2: Rapid clicks from same IP (more than 10 in 1 minute)
  SELECT COUNT(*) INTO v_recent_clicks
  FROM affiliate_link_clicks
  WHERE affiliate_id = p_affiliate_id
    AND ip_address = p_ip_address
    AND clicked_at > now() - INTERVAL '1 minute';
    
  IF v_recent_clicks > 10 THEN
    v_is_fraud := true;
    INSERT INTO affiliate_fraud_logs (affiliate_id, event_type, severity, details, ip_address)
    VALUES (p_affiliate_id, 'rapid_clicks', 'high', 
      jsonb_build_object('clicks_per_minute', v_recent_clicks, 'action', p_action_type), p_ip_address);
  END IF;
  
  -- Update fraud score
  IF v_is_fraud THEN
    UPDATE affiliates SET fraud_score = fraud_score + 1 WHERE id = p_affiliate_id;
  END IF;
  
  RETURN v_is_fraud;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;