-- ============================================
-- MIGRATIONS AUTOMATION - Helper Functions
-- ============================================

-- Function to check if table exists
CREATE OR REPLACE FUNCTION pg_table_is_visible(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = $1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if index exists  
CREATE OR REPLACE FUNCTION pg_index_exists(index_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname = $1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get table policies
CREATE OR REPLACE FUNCTION get_table_policies(table_name TEXT)
RETURNS TABLE(
  policy_name TEXT,
  policy_cmd TEXT,
  policy_permissive TEXT,
  policy_roles TEXT[],
  policy_qual TEXT,
  policy_with_check TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.policyname::TEXT,
    p.cmd::TEXT,
    p.permissive::TEXT,
    p.roles::TEXT[],
    pg_get_expr(p.qual, p.polrelid)::TEXT,
    pg_get_expr(p.with_check, p.polrelid)::TEXT
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  AND p.tablename = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to validate SQL syntax (dry run)
-- This executes EXPLAIN without actually running the query
CREATE OR REPLACE FUNCTION validate_sql_syntax(sql TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Try to EXPLAIN the query
  EXECUTE 'EXPLAIN ' || sql;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to execute SQL as service role (DANGEROUS - Master only)
-- This is intentionally limited and logged
CREATE OR REPLACE FUNCTION execute_sql_as_service_role(sql_query TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_is_master BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check if user is master
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id AND role = 'master'
  ) INTO v_is_master;
  
  IF NOT v_is_master THEN
    RAISE EXCEPTION 'Master role required to execute SQL';
  END IF;
  
  -- Log the execution attempt
  INSERT INTO activity_logs (
    user_id,
    action_type,
    action_description,
    metadata
  ) VALUES (
    v_user_id,
    'sql_execution',
    'Executed SQL via execute_sql_as_service_role',
    jsonb_build_object('sql_preview', left(sql_query, 200))
  );
  
  -- Execute the query
  EXECUTE sql_query;
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO activity_logs (
    user_id,
    action_type,
    action_description,
    metadata
  ) VALUES (
    v_user_id,
    'sql_execution_failed',
    'SQL execution failed',
    jsonb_build_object('error', SQLERRM, 'sql_preview', left(sql_query, 200))
  );
  
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;