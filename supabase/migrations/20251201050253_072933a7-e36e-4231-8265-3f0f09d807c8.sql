-- =====================================================
-- NOVA ARQUITETURA DE CADASTRO DE USUÁRIOS
-- =====================================================
-- Ao criar um auth.user, automaticamente cria:
-- 1. Profile (dados básicos)
-- 2. Cliente (dados de assinatura + vencimento)
-- 3. User Role como 'client'
-- 4. User Subscription como 'trial' (3 dias grátis)
-- =====================================================

-- Ajustar trial padrão para 3 dias
ALTER TABLE public.user_subscriptions 
ALTER COLUMN current_period_end SET DEFAULT (now() + interval '3 days'),
ALTER COLUMN trial_end SET DEFAULT (now() + interval '3 days');

-- Função que cria todo o setup do cliente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nome text;
  _telefone text;
  _origem text;
  _plano text;
  _cliente_id uuid;
BEGIN
  -- Extrair dados do metadata do auth.users
  _nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  _telefone := COALESCE(NEW.raw_user_meta_data->>'telefone', NEW.raw_user_meta_data->>'phone', '');
  _origem := COALESCE(NEW.raw_user_meta_data->>'origem_cadastro', 'Website');
  _plano := COALESCE(NEW.raw_user_meta_data->>'plano', 'Mensal');

  -- 1. Criar profile (se não existir - pode ter trigger antigo)
  INSERT INTO public.profiles (id, nome, email, telefone, telefone_whatsapp)
  VALUES (
    NEW.id,
    _nome,
    NEW.email,
    _telefone,
    _telefone
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    updated_at = now();

  -- 2. Criar registro de cliente com 3 dias de trial
  INSERT INTO public.clientes (
    user_id,
    nome,
    email,
    telefone,
    origem_cadastro,
    plano,
    situacao,
    dispositivo_contratado,
    data_contratacao,
    data_vencimento,
    data_cadastro,
    cliente_ativo
  ) VALUES (
    NEW.id,
    _nome,
    NEW.email,
    _telefone,
    _origem::origem_cadastro,
    _plano::plano_cliente,
    'Testando'::situacao_cliente,
    'Computador'::dispositivo_tipo,
    now(),
    now() + interval '3 days', -- 3 dias de trial
    now(),
    true
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO _cliente_id;

  -- Se não inseriu (já existia), buscar o id
  IF _cliente_id IS NULL THEN
    SELECT id INTO _cliente_id FROM public.clientes WHERE user_id = NEW.id;
  END IF;

  -- 3. Criar role 'client' para o usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. Criar subscription como trial (3 dias)
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    current_period_start,
    current_period_end,
    trial_end
  ) VALUES (
    NEW.id,
    'trial',
    now(),
    now() + interval '3 days',
    now() + interval '3 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Adicionar constraint unique para user_id em clientes (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clientes_user_id_unique' 
    AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes ADD CONSTRAINT clientes_user_id_unique UNIQUE (user_id);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- Ignorar se já existe
END $$;

-- Adicionar constraint unique para user_id em user_subscriptions (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_subscriptions_user_id_unique' 
    AND conrelid = 'public.user_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- Ignorar se já existe
END $$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar novo trigger completo
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_complete();

-- Função helper para verificar se usuário está com acesso válido (não vencido)
CREATE OR REPLACE FUNCTION public.user_has_valid_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE user_id = _user_id
      AND cliente_ativo = true
      AND (data_vencimento IS NULL OR data_vencimento >= now())
  )
$$;

-- Função helper para obter dias restantes do acesso
CREATE OR REPLACE FUNCTION public.user_access_days_remaining(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    GREATEST(0, EXTRACT(DAY FROM (data_vencimento - now()))::integer),
    0
  )
  FROM public.clientes
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Comentários
COMMENT ON FUNCTION public.handle_new_user_complete() IS 'Cria profile, cliente, role e subscription automaticamente ao registrar usuário';
COMMENT ON FUNCTION public.user_has_valid_access(uuid) IS 'Verifica se usuário tem acesso válido (não vencido)';
COMMENT ON FUNCTION public.user_access_days_remaining(uuid) IS 'Retorna dias restantes de acesso do usuário';