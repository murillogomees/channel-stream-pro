-- =====================================================
-- SCRIPT 2: DROP ALL RLS POLICIES
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute BEFORE dropping tables if needed separately
-- =====================================================

-- Drop all RLS policies on all tables in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
        RAISE NOTICE 'Dropped policy: % on %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

-- Disable RLS on all tables (in case tables still exist)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
        RAISE NOTICE 'Disabled RLS on: %', r.tablename;
    END LOOP;
END $$;

-- Verify no policies remain
SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';
