-- ================================================
-- 2. CORRIGIR POLÍTICAS RLS - RECOMMENDATIONS_CACHE
-- ================================================
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.recommendations_cache;
DROP POLICY IF EXISTS "System can insert recommendations" ON public.recommendations_cache;
DROP POLICY IF EXISTS "Admins can manage all recommendations" ON public.recommendations_cache;

CREATE POLICY "Users can view own recommendations"
ON public.recommendations_cache
FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "System can insert recommendations"
ON public.recommendations_cache
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage all recommendations"
ON public.recommendations_cache
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- ================================================
-- PAYMENTS - Corrigir políticas
-- ================================================
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;

CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all payments"
ON public.payments
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- ================================================
-- 3. ADICIONAR search_path ÀS FUNÇÕES QUE FALTAM
-- ================================================

-- Recriar update_affiliate_balance_on_confirm com search_path
CREATE OR REPLACE FUNCTION public.update_affiliate_balance_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Recriar decrement_affiliate_balance_on_withdrawal com search_path
CREATE OR REPLACE FUNCTION public.decrement_affiliate_balance_on_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Recriar update_affiliate_tier com search_path
CREATE OR REPLACE FUNCTION public.update_affiliate_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Recriar track_affiliate_click com search_path
CREATE OR REPLACE FUNCTION public.track_affiliate_click(
  p_affiliate_id uuid, 
  p_ip_address text DEFAULT NULL, 
  p_user_agent text DEFAULT NULL, 
  p_referrer text DEFAULT NULL, 
  p_utm_source text DEFAULT NULL, 
  p_utm_medium text DEFAULT NULL, 
  p_utm_campaign text DEFAULT NULL, 
  p_landing_page text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  UPDATE affiliates 
  SET 
    total_clicks = total_clicks + 1,
    last_click_at = now()
  WHERE id = p_affiliate_id;
  
  RETURN v_click_id;
END;
$$;

-- Recriar check_affiliate_fraud com search_path
CREATE OR REPLACE FUNCTION public.check_affiliate_fraud(
  p_affiliate_id uuid, 
  p_ip_address text, 
  p_action_type text DEFAULT 'click'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_fraud BOOLEAN := false;
  v_affiliate_ip TEXT;
  v_recent_clicks INTEGER;
BEGIN
  SELECT phone INTO v_affiliate_ip FROM affiliates WHERE id = p_affiliate_id;
  
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
  
  IF v_is_fraud THEN
    UPDATE affiliates SET fraud_score = fraud_score + 1 WHERE id = p_affiliate_id;
  END IF;
  
  RETURN v_is_fraud;
END;
$$;

-- Recriar create_affiliate_referral_on_coupon_use com search_path
CREATE OR REPLACE FUNCTION public.create_affiliate_referral_on_coupon_use()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_affiliate_id UUID;
  v_commission_type TEXT;
  v_commission_value NUMERIC;
BEGIN
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
$$;