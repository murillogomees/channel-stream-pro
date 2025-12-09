-- Versão ultra-robusta do hook que nunca quebra o JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  app_user_role text := 'client';
  user_uuid uuid;
  claims jsonb;
BEGIN
  -- Garantir que event e claims existem
  IF event IS NULL THEN
    RETURN event;
  END IF;
  
  -- Extrair claims existentes
  claims := COALESCE(event->'claims', '{}'::jsonb);
  
  -- Tentar extrair user_id de forma segura
  BEGIN
    user_uuid := (event->>'user_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    user_uuid := NULL;
  END;
  
  -- Se não houver user_id válido, retornar evento sem modificação
  IF user_uuid IS NULL THEN
    RETURN event;
  END IF;
  
  -- Buscar role de forma segura
  BEGIN
    SELECT 
      CASE 
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_uuid AND role = 'master'::app_role) THEN 'master'
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_uuid AND role = 'admin'::app_role) THEN 'admin'
        ELSE 'client'
      END 
    INTO app_user_role;
  EXCEPTION WHEN OTHERS THEN
    app_user_role := 'client';
  END;

  -- Adicionar claims customizados de forma segura
  claims := jsonb_set(claims, '{app_role}', to_jsonb(app_user_role), true);
  claims := jsonb_set(claims, '{user_role}', to_jsonb(app_user_role), true);
  claims := jsonb_set(claims, '{is_master}', to_jsonb(app_user_role = 'master'), true);
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(app_user_role IN ('admin', 'master')), true);
  
  -- Atualizar claims no evento
  event := jsonb_set(event, '{claims}', claims, true);

  RETURN event;
EXCEPTION WHEN OTHERS THEN
  -- Em qualquer erro, retornar evento original intacto
  RETURN event;
END;
$$;

-- Garantir permissões para o hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO anon;