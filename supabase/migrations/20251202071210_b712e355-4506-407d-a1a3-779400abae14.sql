-- Migration: RLS Coverage System
-- Creates tables and functions for RLS audit and fixes

-- Table to store RLS manifest (expected policies)
CREATE TABLE IF NOT EXISTS public.rls_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text NOT NULL,
  table_name text NOT NULL,
  action text NOT NULL, -- SELECT, INSERT, UPDATE, DELETE, ALL
  policy_name text NOT NULL,
  expected_using text,
  expected_with_check text,
  required_for_roles text[] DEFAULT ARRAY['client'],
  severity text DEFAULT 'medium', -- high, medium, low
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(schema_name, table_name, policy_name)
);

-- Table to store RLS fix backups
CREATE TABLE IF NOT EXISTS public.rls_fix_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_timestamp timestamptz NOT NULL DEFAULT now(),
  schema_name text NOT NULL,
  table_name text NOT NULL,
  policy_name text,
  policy_definition text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  restore_sql text,
  metadata jsonb DEFAULT '{}'
);

-- Table to store RLS scan results
CREATE TABLE IF NOT EXISTS public.rls_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  scan_timestamp timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  action text,
  issue_type text NOT NULL, -- missing_policy, permissive_policy, no_roles, mismatch
  evidence jsonb DEFAULT '[]',
  proposed_fix jsonb,
  status text DEFAULT 'pending', -- pending, fixed, ignored
  fixed_at timestamptz,
  fixed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Function to detect tables without RLS policies
CREATE OR REPLACE FUNCTION public.detect_tables_without_rls()
RETURNS TABLE(
  schema_name text,
  table_name text,
  severity text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    'high'::text AS severity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' -- regular table
    AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND n.nspname NOT LIKE 'pg_temp%'
    AND n.nspname NOT LIKE 'pg_toast_temp%'
    AND NOT EXISTS (
      SELECT 1 
      FROM pg_policies p 
      WHERE p.schemaname = n.nspname 
        AND p.tablename = c.relname
    )
  ORDER BY n.nspname, c.relname;
END;
$$;

-- Function to detect permissive policies
CREATE OR REPLACE FUNCTION public.detect_permissive_policies()
RETURNS TABLE(
  schema_name text,
  table_name text,
  policy_name text,
  command text,
  qual text,
  with_check text,
  severity text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.schemaname::text,
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.qual::text,
    p.with_check::text,
    CASE 
      WHEN p.qual ~* '^\s*true\s*$' OR p.with_check ~* '^\s*true\s*$' THEN 'high'
      WHEN COALESCE(trim(p.qual), '') = '' OR COALESCE(trim(p.with_check), '') = '' THEN 'medium'
      ELSE 'low'
    END::text AS severity
  FROM pg_policies p
  WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema')
    AND (
      p.qual IS NULL 
      OR p.qual ~* '^\s*true\s*$'
      OR COALESCE(trim(p.qual), '') = ''
      OR p.with_check IS NULL
      OR p.with_check ~* '^\s*true\s*$'
      OR COALESCE(trim(p.with_check), '') = ''
    )
  ORDER BY p.schemaname, p.tablename, p.policyname;
END;
$$;

-- Function to get current RLS coverage summary
CREATE OR REPLACE FUNCTION public.get_rls_coverage_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_tables int;
  tables_without_rls int;
  permissive_policies int;
BEGIN
  -- Count total tables
  SELECT COUNT(*)
  INTO total_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND n.nspname NOT LIKE 'pg_temp%';

  -- Count tables without RLS
  SELECT COUNT(*)
  INTO tables_without_rls
  FROM detect_tables_without_rls();

  -- Count permissive policies
  SELECT COUNT(*)
  INTO permissive_policies
  FROM detect_permissive_policies();

  result := jsonb_build_object(
    'total_tables', total_tables,
    'tables_without_rls', tables_without_rls,
    'permissive_policies', permissive_policies,
    'coverage_percentage', ROUND((total_tables - tables_without_rls)::numeric / NULLIF(total_tables, 0) * 100, 2),
    'scan_timestamp', now()
  );

  RETURN result;
END;
$$;

-- RLS Policies for new tables
ALTER TABLE public.rls_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_fix_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_scan_results ENABLE ROW LEVEL SECURITY;

-- Only admins and masters can manage RLS coverage
CREATE POLICY "Admins and masters full access rls_manifest"
  ON public.rls_manifest
  FOR ALL
  USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters full access rls_fix_backups"
  ON public.rls_fix_backups
  FOR ALL
  USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins and masters full access rls_scan_results"
  ON public.rls_scan_results
  FOR ALL
  USING (is_admin_or_master(auth.uid()));

-- Grant permissions
GRANT EXECUTE ON FUNCTION detect_tables_without_rls() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_permissive_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION get_rls_coverage_summary() TO authenticated;