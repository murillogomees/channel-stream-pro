-- Tabela de logs de atividades do sistema
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'client_created', 'notification_sent', 'playlist_synced', 'config_updated', etc
  action_description TEXT NOT NULL,
  entity_type TEXT, -- 'client', 'notification', 'playlist', 'config', etc
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs(entity_type);

-- Tabela de atalhos/favoritos do admin
CREATE TABLE IF NOT EXISTS public.admin_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  path TEXT NOT NULL,
  icon TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, path)
);

CREATE INDEX idx_admin_shortcuts_user_id ON public.admin_shortcuts(user_id, order_index);

-- RLS Policies
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_shortcuts ENABLE ROW LEVEL SECURITY;

-- Admins podem visualizar todos os logs
CREATE POLICY "Admins podem visualizar logs"
  ON public.activity_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Sistema pode inserir logs
CREATE POLICY "Sistema pode inserir logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Admins podem gerenciar seus próprios atalhos
CREATE POLICY "Admins podem gerenciar atalhos"
  ON public.admin_shortcuts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

-- Trigger para limpar logs antigos (manter apenas últimos 90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.activity_logs
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Função helper para registrar atividades
CREATE OR REPLACE FUNCTION public.log_activity(
  _user_id UUID,
  _action_type TEXT,
  _action_description TEXT,
  _entity_type TEXT DEFAULT NULL,
  _entity_id TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action_type,
    action_description,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    _user_id,
    _action_type,
    _action_description,
    _entity_type,
    _entity_id,
    _metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;