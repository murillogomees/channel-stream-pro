-- Corrigir custom_access_token_hook para resolver erro de tipo polimórfico
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app_user_role text;
BEGIN
  -- Determinar user_role da aplicação (admin/client) via tabela user_roles
  SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = (event->>'user_id')::uuid AND ur.role = 'admin'
    ) THEN 'admin'
    ELSE 'client'
  END INTO app_user_role;

  -- Sempre forçar o Postgres role do JWT para 'authenticated' (tipo explícito)
  event := jsonb_set(event, '{claims,role}', to_jsonb('authenticated'::text));

  -- Incluir claim separado para uso no app (tipo explícito)
  event := jsonb_set(event, '{claims,user_role}', to_jsonb(app_user_role::text), true);

  RETURN event;
END;
$$;