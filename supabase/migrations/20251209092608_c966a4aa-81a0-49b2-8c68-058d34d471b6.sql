-- ================================================
-- ESTRUTURA BASE PARA IPTVLINK
-- ================================================

-- 1. Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('client', 'admin', 'master');

-- 2. Criar tabela de profiles (source of truth para dados de usuário)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT,
  contact_phone TEXT,
  origem_cadastro TEXT DEFAULT 'Website',
  cliente_ativo BOOLEAN DEFAULT true,
  situacao TEXT DEFAULT 'Testando',
  data_vencimento DATE DEFAULT (CURRENT_DATE + INTERVAL '3 days'),
  plano TEXT,
  valor_pago NUMERIC(10,2) DEFAULT 0,
  data_contratacao DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar tabela de roles (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 4. Tabela de planos de assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'R$',
  period TEXT NOT NULL,
  period_months INTEGER NOT NULL,
  features JSONB DEFAULT '[]',
  cta_text TEXT DEFAULT 'Assinar Agora',
  is_highlighted BOOLEAN DEFAULT false,
  savings_amount NUMERIC(10,2),
  savings_percent NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 1,
  whatsapp_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de conteúdo da homepage
CREATE TABLE public.homepage_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de eventos de segurança
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  user_agent TEXT,
  ip_address TEXT,
  event_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- FUNÇÕES DE SEGURANÇA (SECURITY DEFINER)
-- ================================================

-- Função para verificar se é admin ou master
CREATE OR REPLACE FUNCTION public.is_admin_or_master(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role IN ('admin', 'master')
  );
$$;

-- Função para verificar role específica
CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role = check_role
  );
$$;

-- Função RPC para verificar login suspeito
CREATE OR REPLACE FUNCTION public.check_suspicious_login(_ip_address TEXT, _email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INTEGER;
  is_whitelisted BOOLEAN := false;
BEGIN
  -- Contar tentativas recentes
  SELECT COUNT(*) INTO attempt_count
  FROM public.security_events
  WHERE event_type = 'failed_login'
  AND event_details->>'email' = _email
  AND created_at > NOW() - INTERVAL '15 minutes';
  
  RETURN jsonb_build_object(
    'suspicious', attempt_count >= 5,
    'whitelisted', is_whitelisted,
    'alert_admins', attempt_count >= 10,
    'should_block', attempt_count >= 15,
    'attempt_count', attempt_count
  );
END;
$$;

-- ================================================
-- RLS POLICIES
-- ================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin_or_master());

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin_or_master());

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin_or_master());

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin_or_master());

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin_or_master());

-- Subscription plans policies (public read)
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.subscription_plans
  FOR ALL USING (public.is_admin_or_master());

-- Homepage content policies (public read)
CREATE POLICY "Anyone can view homepage content" ON public.homepage_content
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage homepage content" ON public.homepage_content
  FOR ALL USING (public.is_admin_or_master());

-- Security events policies
CREATE POLICY "Anyone can insert security events" ON public.security_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view security events" ON public.security_events
  FOR SELECT USING (public.is_admin_or_master());

-- ================================================
-- TRIGGER PARA CRIAR PROFILE NO SIGNUP
-- ================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, contact_phone, origem_cadastro)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefone',
    COALESCE(NEW.raw_user_meta_data->>'origem_cadastro', 'Website')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- DADOS INICIAIS
-- ================================================

-- Inserir planos de assinatura
INSERT INTO public.subscription_plans (name, slug, price, period, period_months, features, is_highlighted, savings_amount, savings_percent, display_order, whatsapp_message) VALUES
('Mensal', 'mensal', 30.00, '/mês', 1, '["Mais de 209.000 canais", "Qualidade Full HD e 4K", "Suporte 24/7", "Sem contrato"]', false, null, null, 1, 'Olá! Tenho interesse no plano Mensal.'),
('Trimestral', 'trimestral', 79.00, '/3 meses', 3, '["Mais de 209.000 canais", "Qualidade Full HD e 4K", "Suporte prioritário 24/7", "Sem contrato", "Economize R$ 10"]', true, 10.00, 11.00, 2, 'Olá! Tenho interesse no plano Trimestral.'),
('Semestral', 'semestral', 149.00, '/6 meses', 6, '["Mais de 209.000 canais", "Qualidade Full HD e 4K", "Suporte VIP 24/7", "Sem contrato", "Economize R$ 30"]', false, 30.00, 16.00, 3, 'Olá! Tenho interesse no plano Semestral.'),
('Anual', 'anual', 279.00, '/ano', 12, '["Mais de 209.000 canais", "Qualidade Full HD e 4K", "Suporte VIP dedicado 24/7", "Sem contrato", "Economize R$ 80"]', false, 80.00, 22.00, 4, 'Olá! Tenho interesse no plano Anual.');

-- Inserir conteúdo hero
INSERT INTO public.homepage_content (section_key, content) VALUES
('hero', '{"features": ["Teste Grátis", "Sem Contrato", "Suporte 24/7"], "description": "Mais de 209.000 canais em Full HD e 4K com qualidade premium", "whatsapp_number": "556131425880", "cta_primary_text": "Ativar Meu Acesso Agora", "trust_indicators": ["Sem Contrato", "Suporte 24/7", "Acesso Global", "Cancele Quando Quiser"], "whatsapp_message": "Olá! Gostaria de fazer o teste grátis.", "cta_secondary_text": "Falar com Suporte"}'::jsonb);