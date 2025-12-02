-- =====================================================
-- RLS Audit System - Funções de Análise Completa
-- =====================================================

-- 1. Função para listar todas as políticas RLS
CREATE OR REPLACE FUNCTION get_all_rls_policies()
RETURNS TABLE(
  schemaname name,
  tablename name,
  policyname name,
  permissive text,
  roles name[],
  cmd text,
  qual text,
  with_check text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT 
    schemaname,
    tablename,
    policyname,
    permissive::text,
    roles,
    cmd,
    qual::text,
    with_check::text
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$$;

-- 2. Função para listar tabelas sem RLS
CREATE OR REPLACE FUNCTION get_tables_without_rls()
RETURNS TABLE(
  schemaname name,
  tablename name,
  rowsecurity boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT 
    schemaname::name,
    tablename::name,
    rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_pg_%'
    AND rowsecurity = false
  ORDER BY tablename;
$$;

-- 3. Função para detectar políticas permissivas
CREATE OR REPLACE FUNCTION detect_permissive_rls_policies()
RETURNS TABLE(
  table_name name,
  policy_name name,
  command text,
  issue_type text,
  severity text,
  policy_definition text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.tablename,
    p.policyname,
    p.cmd,
    CASE 
      WHEN p.qual::text ~ '^\s*true\s*$' OR p.qual::text = '(true)' THEN 'USING clause is always true'
      WHEN p.with_check::text ~ '^\s*true\s*$' OR p.with_check::text = '(true)' THEN 'WITH CHECK clause is always true'
      WHEN p.qual IS NULL AND p.cmd IN ('SELECT', 'DELETE') THEN 'Missing USING clause'
      WHEN p.with_check IS NULL AND p.cmd IN ('INSERT', 'UPDATE') THEN 'Missing WITH CHECK clause'
      ELSE 'Potential security issue'
    END,
    CASE
      WHEN p.qual::text ~ '^\s*true\s*$' OR p.with_check::text ~ '^\s*true\s*$' THEN 'critical'
      WHEN p.qual IS NULL OR p.with_check IS NULL THEN 'high'
      ELSE 'medium'
    END,
    COALESCE('USING: ' || p.qual::text, '') || COALESCE(' | WITH CHECK: ' || p.with_check::text, '')
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND (
      p.qual::text ~ '^\s*true\s*$' 
      OR p.qual::text = '(true)'
      OR p.with_check::text ~ '^\s*true\s*$'
      OR p.with_check::text = '(true)'
      OR (p.qual IS NULL AND p.cmd IN ('SELECT', 'DELETE'))
      OR (p.with_check IS NULL AND p.cmd IN ('INSERT', 'UPDATE'))
    )
  ORDER BY 
    CASE 
      WHEN p.qual::text ~ '^\s*true\s*$' OR p.with_check::text ~ '^\s*true\s*$' THEN 1
      ELSE 2
    END,
    p.tablename;
END;
$$;

-- 4. Função para análise completa de segurança RLS
CREATE OR REPLACE FUNCTION run_complete_rls_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
  v_tables_without_rls integer;
  v_permissive_policies integer;
  v_total_policies integer;
  v_issues jsonb;
BEGIN
  -- Contar tabelas sem RLS
  SELECT COUNT(*) INTO v_tables_without_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND rowsecurity = false;
  
  -- Contar políticas permissivas
  SELECT COUNT(*) INTO v_permissive_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual::text ~ '^\s*true\s*$' 
      OR with_check::text ~ '^\s*true\s*$'
    );
  
  -- Contar total de políticas
  SELECT COUNT(*) INTO v_total_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Construir lista de issues
  SELECT jsonb_agg(
    jsonb_build_object(
      'table', tablename,
      'policy', policyname,
      'command', command,
      'issue', issue_type,
      'severity', severity,
      'definition', policy_definition
    )
  ) INTO v_issues
  FROM detect_permissive_rls_policies();
  
  -- Montar resultado
  v_result := jsonb_build_object(
    'timestamp', now(),
    'summary', jsonb_build_object(
      'tables_without_rls', v_tables_without_rls,
      'permissive_policies', v_permissive_policies,
      'total_policies', v_total_policies,
      'security_score', GREATEST(0, 100 - (v_tables_without_rls * 20) - (v_permissive_policies * 10))
    ),
    'issues', COALESCE(v_issues, '[]'::jsonb),
    'status', CASE 
      WHEN v_tables_without_rls > 0 OR v_permissive_policies > 5 THEN 'critical'
      WHEN v_permissive_policies > 0 THEN 'warning'
      ELSE 'healthy'
    END
  );
  
  RETURN v_result;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION get_all_rls_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_without_rls() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_permissive_rls_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION run_complete_rls_audit() TO authenticated;