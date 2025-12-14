-- =====================================================
-- SCRIPT 3: DROP ALL FUNCTIONS
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute to remove all custom functions
-- =====================================================

-- Drop all functions in public schema
DO $$ 
DECLARE 
    r RECORD;
    func_signature TEXT;
BEGIN
    FOR r IN (
        SELECT n.nspname as schema_name,
               p.proname as function_name,
               pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'  -- Only functions, not procedures
    ) LOOP
        func_signature := quote_ident(r.schema_name) || '.' || quote_ident(r.function_name) || '(' || r.args || ')';
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', func_signature;
    END LOOP;
END $$;

-- Drop all procedures in public schema
DO $$ 
DECLARE 
    r RECORD;
    proc_signature TEXT;
BEGIN
    FOR r IN (
        SELECT n.nspname as schema_name,
               p.proname as procedure_name,
               pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'p'  -- Only procedures
    ) LOOP
        proc_signature := quote_ident(r.schema_name) || '.' || quote_ident(r.procedure_name) || '(' || r.args || ')';
        EXECUTE 'DROP PROCEDURE IF EXISTS ' || proc_signature || ' CASCADE';
        RAISE NOTICE 'Dropped procedure: %', proc_signature;
    END LOOP;
END $$;

-- Drop aggregate functions
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT n.nspname as schema_name,
               p.proname as agg_name,
               pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'a'  -- Aggregates
    ) LOOP
        EXECUTE 'DROP AGGREGATE IF EXISTS ' || quote_ident(r.schema_name) || '.' || quote_ident(r.agg_name) || '(' || r.args || ') CASCADE';
        RAISE NOTICE 'Dropped aggregate: %', r.agg_name;
    END LOOP;
END $$;

-- Verify no functions remain
SELECT n.nspname, p.proname 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';
