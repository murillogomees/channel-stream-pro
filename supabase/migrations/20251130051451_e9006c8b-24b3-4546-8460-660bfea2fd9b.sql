
-- =============================================
-- PAYMENT & SUBSCRIPTION MANAGEMENT TABLES
-- =============================================

-- Subscription status enum
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'canceled', 'expired', 'past_due');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment status enum
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected', 'refunded', 'cancelled', 'in_process');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- User subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  mercado_pago_subscription_id TEXT,
  mercado_pago_customer_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  mercado_pago_payment_id TEXT UNIQUE,
  mercado_pago_preference_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_type TEXT,
  description TEXT,
  external_reference TEXT,
  payer_email TEXT,
  metadata JSONB DEFAULT '{}',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Playback tokens table (for streaming access control)
CREATE TABLE IF NOT EXISTS public.playback_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  content_id TEXT,
  content_type TEXT DEFAULT 'live',
  permissions JSONB DEFAULT '{"can_play": true, "max_quality": "1080p"}',
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  use_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS public.mercado_pago_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  event_type TEXT NOT NULL,
  action TEXT,
  data_id TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_playback_tokens_user_id ON public.playback_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_playback_tokens_expires ON public.playback_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_webhooks_event_type ON public.mercado_pago_webhooks(event_type);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_webhooks ENABLE ROW LEVEL SECURITY;

-- User Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins have full access to subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Payments policies
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins have full access to payments"
  ON public.payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage payments"
  ON public.payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update payments"
  ON public.payments FOR UPDATE
  USING (true);

-- Playback tokens policies
CREATE POLICY "Users can view own playback tokens"
  ON public.playback_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage playback tokens"
  ON public.playback_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage playback tokens"
  ON public.playback_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- Webhook logs policies (admin only)
CREATE POLICY "Admins can view webhook logs"
  ON public.mercado_pago_webhooks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert webhook logs"
  ON public.mercado_pago_webhooks FOR INSERT
  WITH CHECK (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trial')
      AND current_period_end > now()
  );
$$;

-- Function to get user subscription status
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_user_id UUID)
RETURNS TABLE(
  has_subscription BOOLEAN,
  status subscription_status,
  plan_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  can_play BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id IS NOT NULL as has_subscription,
    us.status,
    sp.name as plan_name,
    us.current_period_end as expires_at,
    (us.status IN ('active', 'trial') AND us.current_period_end > now()) as can_play
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
  LEFT JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE p.id = p_user_id;
END;
$$;

-- Function to validate playback token
CREATE OR REPLACE FUNCTION public.validate_playback_token(p_token_hash TEXT, p_ip_address TEXT DEFAULT NULL)
RETURNS TABLE(
  valid BOOLEAN,
  user_id UUID,
  permissions JSONB,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
BEGIN
  -- Get token
  SELECT * INTO v_token
  FROM public.playback_tokens pt
  WHERE pt.token_hash = p_token_hash
    AND pt.revoked_at IS NULL
    AND pt.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB, 'Token not found or expired'::TEXT;
    RETURN;
  END IF;

  -- Check max uses
  IF v_token.use_count >= v_token.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB, 'Token max uses exceeded'::TEXT;
    RETURN;
  END IF;

  -- Check IP restriction if set
  IF v_token.ip_address IS NOT NULL AND v_token.ip_address != p_ip_address THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB, 'IP address mismatch'::TEXT;
    RETURN;
  END IF;

  -- Check user subscription
  IF NOT has_active_subscription(v_token.user_id) THEN
    RETURN QUERY SELECT false, v_token.user_id, NULL::JSONB, 'No active subscription'::TEXT;
    RETURN;
  END IF;

  -- Update usage
  UPDATE public.playback_tokens
  SET use_count = use_count + 1, last_used_at = now()
  WHERE id = v_token.id;

  RETURN QUERY SELECT true, v_token.user_id, v_token.permissions, NULL::TEXT;
END;
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_updated_at();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_updated_at();
