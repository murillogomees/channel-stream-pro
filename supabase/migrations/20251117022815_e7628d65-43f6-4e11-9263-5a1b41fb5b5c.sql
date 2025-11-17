-- Limpar roles duplicados e garantir que murillo@gmail.com seja admin
-- Primeiro, remover roles duplicados (manter apenas admin)
DELETE FROM public.user_roles
WHERE user_id = '7f136599-d816-48a9-afcd-30f9f67580ce'
  AND role = 'client';

-- Garantir que o role admin existe
INSERT INTO public.user_roles (user_id, role)
VALUES ('7f136599-d816-48a9-afcd-30f9f67580ce', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Criar função helper para facilitar adicionar admins no futuro
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Buscar user_id pelo email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', user_email;
  END IF;

  -- Remover role de client se existir
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'client';

  -- Adicionar role de admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Usuário % (%) agora é administrador', user_email, target_user_id;
END;
$$;

COMMENT ON FUNCTION public.make_user_admin IS 'Converte um usuário em administrador removendo o role de client e adicionando o role de admin';

-- Melhorar a função custom_access_token_hook para garantir consistência
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
  is_admin_user boolean;
BEGIN
  -- Verificar se o usuário é admin (prioridade máxima)
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.user_id = (event->>'user_id')::uuid
      AND ur.role = 'admin'
  ) INTO is_admin_user;

  IF is_admin_user THEN
    user_role := 'admin';
  ELSE
    -- Se não for admin, buscar o role (deve ser client)
    SELECT ur.role::text INTO user_role
    FROM public.user_roles ur
    WHERE ur.user_id = (event->>'user_id')::uuid
    LIMIT 1;
  END IF;

  -- Adicionar user_role ao JWT
  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(user_role));
  ELSE
    -- Se não tem role, adicionar client por padrão
    event := jsonb_set(event, '{claims,user_role}', to_jsonb('client'));
  END IF;

  RETURN event;
END;
$$;