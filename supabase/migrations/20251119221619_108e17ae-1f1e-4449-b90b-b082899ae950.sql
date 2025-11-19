-- Adicionar victor@iptvlink.com.br como administrador do sistema

-- 1. Buscar user_id do victor@iptvlink.com.br
DO $$
DECLARE
  victor_user_id UUID;
BEGIN
  -- Buscar o ID do usuário victor
  SELECT id INTO victor_user_id
  FROM auth.users
  WHERE email = 'victor@iptvlink.com.br';

  -- Se o usuário não existir, exibir erro
  IF victor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário victor@iptvlink.com.br não encontrado em auth.users. Por favor, crie o usuário primeiro.';
  END IF;

  -- 2. Adicionar role de admin na tabela user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (victor_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Garantir que existe um profile para o victor
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    victor_user_id,
    'Victor',
    'victor@iptvlink.com.br'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- 4. Adicionar na tabela admin_phones (se necessário para receber notificações)
  INSERT INTO public.admin_phones (name, phone, active)
  VALUES (
    'Victor - Admin',
    '5561999999999', -- Número placeholder - ajustar conforme necessário
    true
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Usuário victor@iptvlink.com.br configurado como administrador com sucesso!';
END $$;