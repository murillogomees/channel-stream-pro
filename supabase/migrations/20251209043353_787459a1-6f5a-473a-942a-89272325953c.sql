-- Remover funções duplicadas obsoletas

-- run_profiles_migration_batch com 2 params (referencia tabela clientes removida)
DROP FUNCTION IF EXISTS public.run_profiles_migration_batch(uuid, integer);

-- run_profiles_migration_batch com 3 params (referencia tabela clientes removida)  
DROP FUNCTION IF EXISTS public.run_profiles_migration_batch(uuid, integer, integer);

-- toggle_feature_flag com character varying (duplicata - manter apenas text)
DROP FUNCTION IF EXISTS public.toggle_feature_flag(character varying, boolean, integer);

-- Garantir que toggle_feature_flag existe com text e search_path correto
CREATE OR REPLACE FUNCTION public.toggle_feature_flag(
  p_flag_name text, 
  p_enabled boolean, 
  p_percentage integer DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE feature_flag_config
  SET 
    enabled = p_enabled,
    percentage = p_percentage,
    updated_at = NOW()
  WHERE flag_name = p_flag_name;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag % not found', p_flag_name;
  END IF;
END;
$$;