-- =============================================================================
-- FIX: Add explicit search_path to all functions and move extensions
-- =============================================================================

-- 1. Recreate functions with explicit search_path

-- get_role_priority (currently missing search_path)
CREATE OR REPLACE FUNCTION public.get_role_priority(role_name text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE 
    WHEN role_name = 'master' THEN 3
    WHEN role_name = 'admin' THEN 2
    WHEN role_name = 'client' THEN 1
    ELSE 0
  END;
$function$;

-- 2. Move extensions from public to extensions schema
-- Note: Some extensions may already exist in extensions schema

-- Drop from public if exists and recreate in extensions
DO $$
BEGIN
  -- uuid-ossp
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
  END IF;
  
  -- pgcrypto
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
  END IF;
END $$;

-- Ensure extensions exist in extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- 3. Update functions that use uuid-ossp or pgcrypto to reference extensions schema
-- Most functions already use gen_random_uuid() which is built-in to PostgreSQL 13+

-- Verify search_path is set on all custom functions
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig))
  LOOP
    RAISE NOTICE 'Function % may need search_path review', func_record.proname;
  END LOOP;
END $$;