-- Criar a função custom_access_token_hook que o GoTrue está esperando
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_id uuid;
BEGIN
  -- Extrair claims do evento
  claims := event->'claims';
  user_id := (event->>'user_id')::uuid;
  
  -- Buscar a role do usuário (prioridade: master > admin > client)
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_roles.user_id = custom_access_token_hook.user_id
  ORDER BY 
    CASE role 
      WHEN 'master' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'client' THEN 3 
      ELSE 4 
    END
  LIMIT 1;
  
  -- Se não encontrou role, usar 'client' como padrão
  IF user_role IS NULL THEN
    user_role := 'client';
  END IF;
  
  -- Adicionar role aos claims
  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  
  -- Retornar evento com claims atualizados
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Garantir permissão para supabase_auth_admin executar
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;