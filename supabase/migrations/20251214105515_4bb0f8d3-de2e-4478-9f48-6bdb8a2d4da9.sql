-- Garantir que murillo@gmail.com tenha APENAS role master
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Descobrir o id do usuário pelo e-mail
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'murillo@gmail.com'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário murillo@gmail.com não encontrado em auth.users';
  END IF;

  -- Remover qualquer role existente desse usuário
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id;

  -- Inserir apenas role master
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'master'::public.app_role);
END $$;