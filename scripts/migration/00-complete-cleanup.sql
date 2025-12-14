-- =====================================================
-- MASTER CLEANUP SCRIPT
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Executes ALL cleanup in correct order
-- =====================================================

-- =====================================================
-- STEP 1: DISABLE TRIGGERS AND CONSTRAINTS
-- =====================================================
SET session_replication_role = 'replica';

-- =====================================================
-- STEP 2: DROP ALL RLS POLICIES
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    drop_count INT := 0;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
        drop_count := drop_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % RLS policies', drop_count;
END $$;

-- =====================================================
-- STEP 3: DROP ALL TRIGGERS
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    drop_count INT := 0;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % triggers', drop_count;
END $$;

-- =====================================================
-- STEP 4: DROP ALL VIEWS (before tables due to dependencies)
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    drop_count INT := 0;
BEGIN
    FOR r IN (SELECT matviewname FROM pg_matviews WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS public.' || quote_ident(r.matviewname) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % views', drop_count;
END $$;

-- =====================================================
-- STEP 5: DROP ALL TABLES
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    drop_count INT := 0;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % tables', drop_count;
END $$;

-- =====================================================
-- STEP 6: DROP ALL SEQUENCES
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    drop_count INT := 0;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % sequences', drop_count;
END $$;

-- =====================================================
-- STEP 7: DROP ALL FUNCTIONS
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    func_signature TEXT;
    drop_count INT := 0;
BEGIN
    FOR r IN (
        SELECT n.nspname as schema_name,
               p.proname as function_name,
               pg_get_function_identity_arguments(p.oid) as args,
               p.prokind
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    ) LOOP
        func_signature := quote_ident(r.schema_name) || '.' || quote_ident(r.function_name) || '(' || r.args || ')';
        IF r.prokind = 'f' THEN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || func_signature || ' CASCADE';
        ELSIF r.prokind = 'p' THEN
            EXECUTE 'DROP PROCEDURE IF EXISTS ' || func_signature || ' CASCADE';
        ELSIF r.prokind = 'a' THEN
            EXECUTE 'DROP AGGREGATE IF EXISTS ' || func_signature || ' CASCADE';
        END IF;
        drop_count := drop_count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % functions/procedures', drop_count;
END $$;

-- =====================================================
-- STEP 8: DROP ALL CUSTOM TYPES
-- =====================================================
DO $$ 
DECLARE 
    r RECORD;
    drop_count INT := 0;
BEGIN
    -- Enums
    FOR r IN (
        SELECT t.typname, n.nspname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.typname) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    
    -- Composite types (excluding table row types)
    FOR r IN (
        SELECT t.typname, n.nspname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'c'
        AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.reltype = t.oid)
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.typname) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    
    -- Domains
    FOR r IN (
        SELECT t.typname, n.nspname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'd'
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.typname) || ' CASCADE';
        drop_count := drop_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Dropped % custom types', drop_count;
END $$;

-- =====================================================
-- STEP 9: RE-ENABLE TRIGGERS
-- =====================================================
SET session_replication_role = 'origin';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
SELECT 'Tables remaining:' as check_type, COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 'Views remaining:', COUNT(*) FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT 'Functions remaining:', COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'
UNION ALL
SELECT 'Policies remaining:', COUNT(*) FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'Triggers remaining:', COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'
UNION ALL
SELECT 'Sequences remaining:', COUNT(*) FROM information_schema.sequences WHERE sequence_schema = 'public';
