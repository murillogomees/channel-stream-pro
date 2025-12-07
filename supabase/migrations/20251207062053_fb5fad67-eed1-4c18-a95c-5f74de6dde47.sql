-- Dropar função existente e recriar
DROP FUNCTION IF EXISTS get_profile_or_cliente(uuid);

CREATE OR REPLACE FUNCTION get_profile_or_cliente(p_id uuid)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text,
  situacao text,
  plano text,
  data_vencimento timestamptz,
  cliente_ativo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_use_profiles_only boolean;
BEGIN
  SELECT (config_value->>'enabled')::boolean INTO v_use_profiles_only
  FROM app_feature_flags WHERE flag_name = 'USE_PROFILES_ONLY';
  
  IF v_use_profiles_only = true THEN
    RETURN QUERY SELECT 
      p.id, p.nome, p.email, p.telefone, 
      p.situacao::text, p.plano::text, p.data_vencimento, p.cliente_ativo
    FROM profiles p WHERE p.id = p_id;
  ELSE
    IF EXISTS (SELECT 1 FROM profiles WHERE profiles.id = p_id) THEN
      RETURN QUERY SELECT 
        p.id, p.nome, p.email, p.telefone, 
        p.situacao::text, p.plano::text, p.data_vencimento, p.cliente_ativo
      FROM profiles p WHERE p.id = p_id;
    ELSE
      RETURN QUERY SELECT 
        c.id, c.nome, c.email, c.telefone,
        c.situacao::text, c.plano::text, c.data_vencimento, c.cliente_ativo
      FROM clientes c WHERE c.id = p_id;
    END IF;
  END IF;
END;
$$;