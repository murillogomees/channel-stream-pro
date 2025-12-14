-- =====================================================
-- SCRIPT 8: DROP ALL VIEWS
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute to remove all views and materialized views
-- =====================================================

-- Drop all materialized views in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT matviewname
        FROM pg_matviews
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS public.' || quote_ident(r.matviewname) || ' CASCADE';
        RAISE NOTICE 'Dropped materialized view: %', r.matviewname;
    END LOOP;
END $$;

-- Drop all regular views in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', r.viewname;
    END LOOP;
END $$;

-- Verify no views remain
SELECT viewname FROM pg_views WHERE schemaname = 'public';
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';
