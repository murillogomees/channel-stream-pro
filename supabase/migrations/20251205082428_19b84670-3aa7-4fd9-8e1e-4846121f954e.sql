-- Fix handle_new_user_complete trigger to use correct enum value (lowercase)
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
    'computador'::dispositivo_tipo,  -- Fixed: lowercase enum value
    now(),
    now() + interval '3 days',
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