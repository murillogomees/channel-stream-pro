-- Atualiza handle_new_user_complete para popular todos os campos de trial na profiles também
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
  _data_vencimento timestamptz;
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
  _plano := 'Mensal'; -- Plano default após trial
  
  -- Data de vencimento: 3 dias após cadastro (trial)
  _data_vencimento := now() + interval '3 days';

  -- 1. Criar profile com TODOS os dados de trial
  INSERT INTO public.profiles (
    id, 
    nome, 
    email, 
    telefone, 
    telefone_whatsapp,
    contact_phone,
    situacao,
    plano,
    data_vencimento,
    data_contratacao,
    cliente_ativo,
    origem_cadastro
  )
  VALUES (
    NEW.id,
    _nome,
    NEW.email,
    _telefone,
    _telefone,
    _telefone,
    'Testando'::situacao_cliente,  -- Situação trial
    _plano::plano_cliente,
    _data_vencimento,              -- 3 dias após cadastro
    now(),
    true,
    _origem::origem_cadastro
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    telefone_whatsapp = EXCLUDED.telefone_whatsapp,
    contact_phone = EXCLUDED.contact_phone,
    situacao = EXCLUDED.situacao,
    plano = EXCLUDED.plano,
    data_vencimento = EXCLUDED.data_vencimento,
    data_contratacao = EXCLUDED.data_contratacao,
    cliente_ativo = EXCLUDED.cliente_ativo,
    origem_cadastro = EXCLUDED.origem_cadastro,
    updated_at = now();

  -- 2. Criar registro de cliente (legado) com 3 dias de trial
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
    'computador'::dispositivo_tipo,
    now(),
    _data_vencimento,
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
    _data_vencimento,
    _data_vencimento
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user_complete() IS 'Cria profile com trial de 3 dias, cliente, role e subscription automaticamente ao registrar usuário';