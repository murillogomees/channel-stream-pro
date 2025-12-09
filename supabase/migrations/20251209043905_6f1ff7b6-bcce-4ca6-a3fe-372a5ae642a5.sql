-- Corrigir custom_access_token_hook para não quebrar o JWT
-- O problema é que modificar claims.role pode causar problemas
-- Vamos usar uma abordagem mais segura

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  app_user_role text;
  user_uuid uuid;
BEGIN
  -- Extrair user_id do evento
  user_uuid := (event->>'user_id')::uuid;
  
  -- Se não houver user_id, retornar evento sem modificação
  IF user_uuid IS NULL THEN
    RETURN event;
  END IF;
  
  -- Buscar role com prioridade: master > admin > client
  SELECT COALESCE(
    (SELECT 'master' FROM public.user_roles 
     WHERE user_id = user_uuid AND role = 'master'::app_role LIMIT 1),
    (SELECT 'admin' FROM public.user_roles 
     WHERE user_id = user_uuid AND role = 'admin'::app_role LIMIT 1),
    'client'
  ) INTO app_user_role;

  -- Adicionar claims customizados SEM modificar o role original do Supabase
  -- Isso evita quebrar o JWT
  event := jsonb_set(event, '{claims,app_role}', to_jsonb(app_user_role), true);
  event := jsonb_set(event, '{claims,user_role}', to_jsonb(app_user_role), true);
  event := jsonb_set(event, '{claims,is_master}', to_jsonb(app_user_role = 'master'), true);
  event := jsonb_set(event, '{claims,is_admin}', to_jsonb(app_user_role IN ('admin', 'master')), true);

  RETURN event;
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, retornar evento original sem modificação
  RETURN event;
END;
$$;