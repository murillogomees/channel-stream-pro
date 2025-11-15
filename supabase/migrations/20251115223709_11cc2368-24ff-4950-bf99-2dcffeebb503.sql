-- =====================================================
-- MIGRAÇÃO DE CORREÇÃO DE SEGURANÇA E RLS
-- =====================================================
-- Corrige problemas críticos de segurança identificados

-- 1. HABILITAR RLS NAS TABELAS EXPOSTAS
-- =====================================================

-- Tabela activation_keys - habilitar RLS
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

-- Criar policies para activation_keys (somente admins)
CREATE POLICY "Admins podem gerenciar activation keys"
  ON public.activation_keys
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tabela code_snippets - habilitar RLS  
ALTER TABLE public.code_snippets ENABLE ROW LEVEL SECURITY;

-- Criar policies para code_snippets (somente admins)
CREATE POLICY "Admins podem gerenciar code snippets"
  ON public.code_snippets
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));


-- 2. ADICIONAR search_path EM TODAS AS FUNÇÕES
-- =====================================================

-- Função: cleanup_old_metrics
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.metrics_snapshots 
  WHERE timestamp < now() - interval '30 days';
  
  DELETE FROM public.health_snapshots 
  WHERE timestamp < now() - interval '30 days';
END;
$$;

-- Função: custom_access_token_hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Buscar o role do usuário (prioriza admin)
  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = (event->>'user_id')::uuid
  ORDER BY (ur.role = 'admin') DESC
  LIMIT 1;

  -- Adicionar user_role ao JWT
  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(user_role));
  END IF;

  RETURN event;
END;
$$;

-- Função: ensure_single_default_m3u
CREATE OR REPLACE FUNCTION public.ensure_single_default_m3u()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.m3u_lists 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Função: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Função: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, telefone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.raw_user_meta_data->>'telefone',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Função: handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;


-- 3. CRIAR TRIGGERS FALTANTES (se não existirem)
-- =====================================================

-- Verificar e criar trigger para handle_new_user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Verificar e criar trigger para handle_new_user_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created_role'
  ) THEN
    CREATE TRIGGER on_auth_user_created_role
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user_role();
  END IF;
END $$;

-- Verificar e criar trigger para ensure_single_default_m3u
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'ensure_single_default_m3u_trigger'
    AND tgrelid = 'public.m3u_lists'::regclass
  ) THEN
    CREATE TRIGGER ensure_single_default_m3u_trigger
      BEFORE INSERT OR UPDATE ON public.m3u_lists
      FOR EACH ROW
      EXECUTE FUNCTION public.ensure_single_default_m3u();
  END IF;
END $$;

-- Verificar e criar trigger para update_updated_at em m3u_lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_m3u_lists_updated_at'
    AND tgrelid = 'public.m3u_lists'::regclass
  ) THEN
    CREATE TRIGGER update_m3u_lists_updated_at
      BEFORE UPDATE ON public.m3u_lists
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 4. HABILITAR REALTIME NAS TABELAS NECESSÁRIAS
-- =====================================================

-- Garantir que as tabelas de notificação suportem realtime
ALTER TABLE public.notification_logs REPLICA IDENTITY FULL;
ALTER TABLE public.clientes REPLICA IDENTITY FULL;
ALTER TABLE public.metrics_snapshots REPLICA IDENTITY FULL;
ALTER TABLE public.health_snapshots REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime (se ainda não estiverem)
DO $$
BEGIN
  -- notification_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notification_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;
  END IF;
  
  -- clientes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'clientes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
  END IF;
  
  -- metrics_snapshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'metrics_snapshots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.metrics_snapshots;
  END IF;
  
  -- health_snapshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'health_snapshots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.health_snapshots;
  END IF;
END $$;