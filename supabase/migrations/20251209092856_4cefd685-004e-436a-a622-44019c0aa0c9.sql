-- ================================================
-- TABELAS ADICIONAIS E COLUNAS FALTANTES
-- ================================================

-- Adicionar coluna theme ao profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';

-- Adicionar colunas à rls_audit_resolutions
ALTER TABLE public.rls_audit_resolutions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'resolved',
ADD COLUMN IF NOT EXISTS suggested_fix TEXT;

-- Tabela de testes A/B
CREATE TABLE public.ab_test_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de resultados A/B
CREATE TABLE public.ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.ab_test_offers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  variant_shown TEXT NOT NULL,
  converted BOOLEAN DEFAULT false,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de logs de autenticação
CREATE TABLE public.auth_sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de IP whitelist
CREATE TABLE public.ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  description TEXT,
  added_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de IP blacklist
CREATE TABLE public.ip_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_until TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de alertas de segurança
CREATE TABLE public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.ab_test_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ab tests" ON public.ab_test_offers FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can view active ab tests" ON public.ab_test_offers FOR SELECT USING (active = true);

CREATE POLICY "Anyone can insert ab results" ON public.ab_test_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view ab results" ON public.ab_test_results FOR SELECT USING (public.is_admin_or_master());

CREATE POLICY "Admins can manage auth logs" ON public.auth_sessions_log FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can insert auth logs" ON public.auth_sessions_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage ip whitelist" ON public.ip_whitelist FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Admins can manage ip blacklist" ON public.ip_blacklist FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Admins can manage security alerts" ON public.security_alerts FOR ALL USING (public.is_admin_or_master());

-- ================================================
-- FUNÇÕES RPC ATUALIZADAS
-- ================================================

-- Atualizar cleanup function para aceitar parâmetro
CREATE OR REPLACE FUNCTION public.cleanup_fase8_old_data(p_dry_run BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_array(
    jsonb_build_object('table_name', 'old_data', 'row_count', 0, 'action', 'preview')
  );
END;
$$;

-- Função para obter estatísticas de auth
CREATE OR REPLACE FUNCTION public.get_auth_statistics(days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_logins', (SELECT COUNT(*) FROM public.auth_sessions_log WHERE event_type = 'login' AND created_at > NOW() - (days || ' days')::INTERVAL),
    'failed_logins', (SELECT COUNT(*) FROM public.security_events WHERE event_type = 'failed_login' AND created_at > NOW() - (days || ' days')::INTERVAL),
    'unique_users', (SELECT COUNT(DISTINCT user_id) FROM public.auth_sessions_log WHERE created_at > NOW() - (days || ' days')::INTERVAL)
  ) INTO result;
  RETURN result;
END;
$$;

-- Função para obter sessões ativas
CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE(user_id UUID, user_email TEXT, last_activity TIMESTAMP WITH TIME ZONE)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (user_id) user_id, user_email, created_at as last_activity
  FROM public.auth_sessions_log
  WHERE event_type = 'login'
  AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY user_id, created_at DESC;
$$;