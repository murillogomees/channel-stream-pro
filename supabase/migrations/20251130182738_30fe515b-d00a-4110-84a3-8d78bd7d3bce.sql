-- Tabela de afiliados (apenas clientes convidados pelo admin)
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC(10, 2) NOT NULL DEFAULT 10,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pix_key TEXT,
  pix_key_type TEXT CHECK (pix_key_type IN ('cpf', 'phone', 'email', 'random')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de indicações/referências
CREATE TABLE public.affiliate_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  coupon_id UUID REFERENCES public.discount_coupons(id) ON DELETE SET NULL,
  plan_purchased TEXT,
  plan_value NUMERIC(10, 2),
  commission_type TEXT NOT NULL,
  commission_value NUMERIC(10, 2) NOT NULL,
  commission_earned NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de saques/retiradas
CREATE TABLE public.affiliate_withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  withdrawal_type TEXT NOT NULL DEFAULT 'pix' CHECK (withdrawal_type IN ('pix', 'credit')),
  pix_key TEXT,
  pix_key_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campo de afiliado na tabela de cupons existente
ALTER TABLE public.discount_coupons 
ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- Atualizar coupon_usage para rastrear referências de afiliados
ALTER TABLE public.coupon_usage 
ADD COLUMN IF NOT EXISTS affiliate_referral_id UUID REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliates_cliente_id ON public.affiliates(cliente_id);
CREATE INDEX idx_affiliates_status ON public.affiliates(status);
CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_status ON public.affiliate_referrals(status);
CREATE INDEX idx_affiliate_withdrawals_affiliate_id ON public.affiliate_withdrawals(affiliate_id);
CREATE INDEX idx_affiliate_withdrawals_status ON public.affiliate_withdrawals(status);
CREATE INDEX idx_discount_coupons_affiliate_id ON public.discount_coupons(affiliate_id);

-- Habilitar RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

-- Policies para affiliates
CREATE POLICY "Admins can manage all affiliates" ON public.affiliates
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Affiliates can view own data" ON public.affiliates
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Affiliates can update own pix info" ON public.affiliates
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies para affiliate_referrals
CREATE POLICY "Admins can manage all referrals" ON public.affiliate_referrals
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Affiliates can view own referrals" ON public.affiliate_referrals
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid())
);

-- Policies para affiliate_withdrawals  
CREATE POLICY "Admins can manage all withdrawals" ON public.affiliate_withdrawals
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Affiliates can view own withdrawals" ON public.affiliate_withdrawals
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid())
);

CREATE POLICY "Affiliates can request withdrawals" ON public.affiliate_withdrawals
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid())
);

-- Função para atualizar estatísticas do afiliado
CREATE OR REPLACE FUNCTION public.update_affiliate_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE public.affiliates
    SET 
      total_referrals = total_referrals + 1,
      total_earnings = total_earnings + NEW.commission_earned,
      available_balance = available_balance + NEW.commission_earned,
      updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para atualizar stats quando referência é confirmada
CREATE TRIGGER trigger_update_affiliate_stats
AFTER INSERT OR UPDATE ON public.affiliate_referrals
FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_stats();

-- Função para deduzir saldo ao solicitar saque
CREATE OR REPLACE FUNCTION public.process_affiliate_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Verificar saldo disponível
    IF (SELECT available_balance FROM public.affiliates WHERE id = NEW.affiliate_id) < NEW.amount THEN
      RAISE EXCEPTION 'Saldo insuficiente para saque';
    END IF;
    
    -- Deduzir saldo
    UPDATE public.affiliates
    SET available_balance = available_balance - NEW.amount, updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  
  -- Se saque for rejeitado, devolver saldo
  IF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    UPDATE public.affiliates
    SET available_balance = available_balance + NEW.amount, updated_at = now()
    WHERE id = NEW.affiliate_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_process_withdrawal
AFTER INSERT OR UPDATE ON public.affiliate_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.process_affiliate_withdrawal();

-- Função para obter status da assinatura do usuário
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(p_user_id UUID)
RETURNS TABLE(
  has_subscription BOOLEAN,
  status TEXT,
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
    us.status = 'active' AND us.current_period_end > now() as can_play
  FROM public.user_subscriptions us
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$;