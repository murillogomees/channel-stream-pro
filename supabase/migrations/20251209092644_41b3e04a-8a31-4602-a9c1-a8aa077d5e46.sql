-- ================================================
-- TABELAS ADICIONAIS PARA COMPATIBILIDADE
-- ================================================

-- Tabela de FAQs da homepage
CREATE TABLE public.homepage_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de shortcuts do admin
CREATE TABLE public.admin_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  path TEXT NOT NULL,
  icon TEXT DEFAULT 'Link',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de badges de status customizados
CREATE TABLE public.custom_status_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT 'gray',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de afiliados
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC(5,2) DEFAULT 10.00,
  total_referrals INTEGER DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de referências de afiliados
CREATE TABLE public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  commission_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  converted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de feature flags
CREATE TABLE public.feature_flag_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  percentage INTEGER DEFAULT 100,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de auditoria de migrations
CREATE TABLE public.migration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'success',
  duration_ms INTEGER,
  details JSONB,
  executed_by UUID REFERENCES auth.users(id)
);

-- Tabela de logs de atividade
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.homepage_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_status_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- FAQs (public read)
CREATE POLICY "Anyone can view FAQs" ON public.homepage_faqs FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage FAQs" ON public.homepage_faqs FOR ALL USING (public.is_admin_or_master());

-- Admin shortcuts
CREATE POLICY "Users can view own shortcuts" ON public.admin_shortcuts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own shortcuts" ON public.admin_shortcuts FOR ALL USING (auth.uid() = user_id);

-- Custom status badges
CREATE POLICY "Anyone can view badges" ON public.custom_status_badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage badges" ON public.custom_status_badges FOR ALL USING (public.is_admin_or_master());

-- Affiliates
CREATE POLICY "Users can view own affiliate" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage affiliates" ON public.affiliates FOR ALL USING (public.is_admin_or_master());

-- Affiliate referrals
CREATE POLICY "Affiliates can view own referrals" ON public.affiliate_referrals 
  FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage referrals" ON public.affiliate_referrals FOR ALL USING (public.is_admin_or_master());

-- Feature flags
CREATE POLICY "Anyone can read flags" ON public.feature_flag_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage flags" ON public.feature_flag_config FOR ALL USING (public.is_admin_or_master());

-- Migration audit
CREATE POLICY "Admins can view audit" ON public.migration_audit FOR SELECT USING (public.is_admin_or_master());
CREATE POLICY "Admins can insert audit" ON public.migration_audit FOR INSERT WITH CHECK (public.is_admin_or_master());

-- Activity logs
CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert activity" ON public.activity_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all activity" ON public.activity_logs FOR SELECT USING (public.is_admin_or_master());

-- ================================================
-- FUNÇÕES RPC FALTANTES
-- ================================================

-- Função para toggle feature flag
CREATE OR REPLACE FUNCTION public.toggle_feature_flag(flag_name_param TEXT, enabled_param BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.feature_flag_config 
  SET enabled = enabled_param, updated_at = NOW()
  WHERE flag_name = flag_name_param;
END;
$$;

-- Função para cleanup (placeholder)
CREATE OR REPLACE FUNCTION public.cleanup_fase8_old_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object('status', 'success', 'message', 'No cleanup needed');
END;
$$;