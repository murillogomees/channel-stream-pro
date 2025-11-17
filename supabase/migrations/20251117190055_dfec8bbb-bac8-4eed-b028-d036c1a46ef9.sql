-- Criar tabela para logs de sessões de autenticação
CREATE TABLE IF NOT EXISTS public.auth_sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'session_refresh', 'access_denied')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_auth_sessions_log_user_id ON public.auth_sessions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_log_event_type ON public.auth_sessions_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_log_created_at ON public.auth_sessions_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_log_ip_address ON public.auth_sessions_log(ip_address);

-- RLS Policies
ALTER TABLE public.auth_sessions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar logs de autenticação"
  ON public.auth_sessions_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir logs de autenticação"
  ON public.auth_sessions_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Função para limpar logs antigos (manter últimos 90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_auth_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_sessions_log
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Função para obter estatísticas de autenticação
CREATE OR REPLACE FUNCTION public.get_auth_statistics(_days integer DEFAULT 7)
RETURNS TABLE(
  date date,
  total_logins bigint,
  unique_users bigint,
  access_denied bigint,
  session_refreshes bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE event_type = 'login') as total_logins,
    COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'login') as unique_users,
    COUNT(*) FILTER (WHERE event_type = 'access_denied') as access_denied,
    COUNT(*) FILTER (WHERE event_type = 'session_refresh') as session_refreshes
  FROM public.auth_sessions_log
  WHERE created_at > now() - (_days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$;

-- Função para obter sessões ativas (últimas 24h com login sem logout correspondente)
CREATE OR REPLACE FUNCTION public.get_active_sessions()
RETURNS TABLE(
  user_id uuid,
  user_email text,
  last_login timestamptz,
  ip_address text,
  user_agent text,
  session_duration interval
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_logins AS (
    SELECT DISTINCT ON (l.user_id)
      l.user_id,
      l.user_email,
      l.created_at as last_login,
      l.ip_address,
      l.user_agent
    FROM public.auth_sessions_log l
    WHERE l.event_type = 'login'
      AND l.created_at > now() - interval '24 hours'
    ORDER BY l.user_id, l.created_at DESC
  )
  SELECT 
    ll.user_id,
    ll.user_email,
    ll.last_login,
    ll.ip_address,
    ll.user_agent,
    now() - ll.last_login as session_duration
  FROM latest_logins ll
  WHERE NOT EXISTS (
    SELECT 1 FROM public.auth_sessions_log lo
    WHERE lo.user_id = ll.user_id
      AND lo.event_type = 'logout'
      AND lo.created_at > ll.last_login
  )
  ORDER BY ll.last_login DESC;
$$;

-- Comentários
COMMENT ON TABLE public.auth_sessions_log IS 'Logs de eventos de autenticação (login, logout, acesso negado)';
COMMENT ON FUNCTION public.get_auth_statistics IS 'Retorna estatísticas agregadas de autenticação por dia';
COMMENT ON FUNCTION public.get_active_sessions IS 'Retorna lista de sessões atualmente ativas (últimas 24h sem logout)';