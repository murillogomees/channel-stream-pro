-- =====================================================
-- SCRIPT 1: DROP ALL TABLES
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute this FIRST before creating new schema
-- =====================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Drop all tables in public schema (cascade to handle dependencies)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END $$;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Verify no tables remain
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
