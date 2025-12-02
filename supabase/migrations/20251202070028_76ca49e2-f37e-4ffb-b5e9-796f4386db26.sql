-- =====================================================
-- Migration Dashboard - Funções e Dados Iniciais (v2)
-- =====================================================

-- 1. Drop função existente se houver conflito
DROP FUNCTION IF EXISTS toggle_feature_flag(text, boolean, integer);
DROP FUNCTION IF EXISTS toggle_feature_flag(text, boolean);

-- 2. Função de limpeza de dados antigos (dry run + execução real)
CREATE OR REPLACE FUNCTION cleanup_fase8_old_data(p_dry_run boolean DEFAULT true)
RETURNS TABLE(
  table_name text,
  rows_deleted bigint,
  action text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_logs bigint;
  v_old_metrics bigint;
  v_old_health bigint;
BEGIN
  -- Contar registros antigos
  SELECT COUNT(*) INTO v_old_logs 
  FROM activity_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  SELECT COUNT(*) INTO v_old_metrics 
  FROM metrics_snapshots 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  SELECT COUNT(*) INTO v_old_health 
  FROM health_snapshots 
  WHERE timestamp < NOW() - INTERVAL '30 days';

  -- Retornar preview ou executar
  IF p_dry_run THEN
    RETURN QUERY
    SELECT 'activity_logs'::text, v_old_logs, 'dry_run'::text
    UNION ALL
    SELECT 'metrics_snapshots'::text, v_old_metrics, 'dry_run'::text
    UNION ALL
    SELECT 'health_snapshots'::text, v_old_health, 'dry_run'::text;
  ELSE
    -- Executar limpeza real
    DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM metrics_snapshots WHERE timestamp < NOW() - INTERVAL '30 days';
    DELETE FROM health_snapshots WHERE timestamp < NOW() - INTERVAL '30 days';
    
    RETURN QUERY
    SELECT 'activity_logs'::text, v_old_logs, 'deleted'::text
    UNION ALL
    SELECT 'metrics_snapshots'::text, v_old_metrics, 'deleted'::text
    UNION ALL
    SELECT 'health_snapshots'::text, v_old_health, 'deleted'::text;
  END IF;
END;
$$;

-- 3. Recriar função para alternar feature flags
CREATE OR REPLACE FUNCTION toggle_feature_flag(
  p_flag_name text,
  p_enabled boolean,
  p_percentage integer DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 4. Popular tabela de feature flags se estiver vazia
INSERT INTO feature_flag_config (flag_name, enabled, percentage, description, rollback_available)
VALUES 
  ('migrate_profiles_unification', false, 0, 'Migração unificada da tabela profiles', true),
  ('enable_new_auth_flow', false, 0, 'Novo fluxo de autenticação JWT', true),
  ('cleanup_deprecated_tables', false, 0, 'Limpeza de tabelas depreciadas', false),
  ('enable_cdn_worker', false, 0, 'CDN Worker para streaming', true)
ON CONFLICT (flag_name) DO NOTHING;

-- 5. Criar alguns logs de audit de exemplo se estiver vazio
INSERT INTO migration_audit (migration_name, status, duration_ms, rows_affected, executed_at)
SELECT 
  'initial_setup',
  'completed',
  1234,
  100,
  NOW() - INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM migration_audit LIMIT 1);

INSERT INTO migration_audit (migration_name, status, duration_ms, rows_affected, executed_at)
SELECT 
  'create_feature_flags',
  'completed',
  456,
  4,
  NOW() - INTERVAL '5 days'
WHERE (SELECT COUNT(*) FROM migration_audit) < 2;

INSERT INTO migration_audit (migration_name, status, duration_ms, rows_affected, error_message, executed_at)
SELECT 
  'test_rollback',
  'rolled_back',
  789,
  50,
  'Teste de rollback executado com sucesso',
  NOW() - INTERVAL '3 days'
WHERE (SELECT COUNT(*) FROM migration_audit) < 3;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_fase8_old_data(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_feature_flag(text, boolean, integer) TO authenticated;