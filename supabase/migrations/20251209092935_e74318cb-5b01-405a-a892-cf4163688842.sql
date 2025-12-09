-- ================================================
-- TODAS AS TABELAS RESTANTES
-- ================================================

-- Adicionar colunas faltantes à affiliates
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(5,2) DEFAULT 0;

-- Adicionar colunas faltantes à affiliate_link_clicks
ALTER TABLE public.affiliate_link_clicks
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT;

-- Tabela de tiers de afiliados
CREATE TABLE public.affiliate_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_referrals INTEGER DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL,
  benefits JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de analytics de afiliados
CREATE TABLE public.affiliate_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  referrals INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  earnings NUMERIC(10,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configuração de afiliados
CREATE TABLE public.affiliate_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de links de afiliados
CREATE TABLE public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  short_code TEXT UNIQUE,
  clicks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de saques de afiliados
CREATE TABLE public.affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_details JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de notificações automáticas
CREATE TABLE public.auto_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  template_key TEXT,
  is_active BOOLEAN DEFAULT true,
  delay_hours INTEGER DEFAULT 0,
  conditions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de backups
CREATE TABLE public.system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL,
  file_path TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configuração do sistema
CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de health checks
CREATE TABLE public.health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  status TEXT DEFAULT 'unknown',
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- FUNÇÕES RPC ADICIONAIS
-- ================================================

CREATE OR REPLACE FUNCTION public.track_affiliate_click(
  p_affiliate_code TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id UUID;
BEGIN
  SELECT id INTO v_affiliate_id FROM public.affiliates WHERE code = p_affiliate_code AND is_active = true;
  
  IF v_affiliate_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;
  
  INSERT INTO public.affiliate_link_clicks (affiliate_id, ip_address, user_agent, referrer)
  VALUES (v_affiliate_id, p_ip_address, p_user_agent, p_referrer);
  
  UPDATE public.affiliates SET total_clicks = total_clicks + 1 WHERE id = v_affiliate_id;
  
  RETURN jsonb_build_object('success', true, 'affiliate_id', v_affiliate_id);
END;
$$;

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tiers" ON public.affiliate_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can manage tiers" ON public.affiliate_tiers FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Affiliates can view own analytics" ON public.affiliate_analytics 
  FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage analytics" ON public.affiliate_analytics FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Anyone can view config" ON public.affiliate_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage config" ON public.affiliate_config FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Affiliates can view own links" ON public.affiliate_links 
  FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Affiliates can manage own links" ON public.affiliate_links 
  FOR ALL USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Affiliates can view own withdrawals" ON public.affiliate_withdrawals 
  FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage withdrawals" ON public.affiliate_withdrawals FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Admins can manage auto notifications" ON public.auto_notifications FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Admins can manage backups" ON public.system_backups FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can view system config" ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage system config" ON public.system_config FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Admins can manage health checks" ON public.health_checks FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can insert health checks" ON public.health_checks FOR INSERT WITH CHECK (true);