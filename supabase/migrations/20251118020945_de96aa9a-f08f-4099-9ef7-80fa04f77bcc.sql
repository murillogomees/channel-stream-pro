-- Criar nova coluna
ALTER TABLE m3u_lists ADD COLUMN plan_type_new text[] DEFAULT ARRAY['teste'];

-- Desabilitar todos os triggers user
ALTER TABLE m3u_lists DISABLE TRIGGER USER;

-- Copiar dados
UPDATE m3u_lists 
SET plan_type_new = CASE 
  WHEN plan_type IS NULL THEN ARRAY['teste']
  ELSE ARRAY[plan_type]
END,
updated_by = COALESCE(created_by, updated_by);

-- Remover coluna antiga
ALTER TABLE m3u_lists DROP COLUMN plan_type;

-- Renomear
ALTER TABLE m3u_lists RENAME COLUMN plan_type_new TO plan_type;

-- Reabilitar triggers
ALTER TABLE m3u_lists ENABLE TRIGGER USER;

-- Comentário
COMMENT ON COLUMN m3u_lists.plan_type IS 'Array de tipos de planos (teste, basico, premium)';

-- Recriar função
DROP FUNCTION IF EXISTS get_m3u_for_client_plan(text, text);

CREATE FUNCTION get_m3u_for_client_plan(
  cliente_plano text,
  cliente_situacao text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_plan_type text;
  selected_list_id uuid;
BEGIN
  IF cliente_situacao IN ('Testando', 'Lead') THEN
    target_plan_type := 'teste';
  ELSIF cliente_plano IN ('Semestral', 'Anual') THEN
    target_plan_type := 'premium';
  ELSE
    target_plan_type := 'basico';
  END IF;

  SELECT id INTO selected_list_id
  FROM m3u_lists
  WHERE status = 'active'
    AND target_plan_type = ANY(plan_type)
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;

  RETURN selected_list_id;
END;
$$;