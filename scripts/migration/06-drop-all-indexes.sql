-- =====================================================
-- SCRIPT 6: DROP ALL INDEXES
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute to remove all custom indexes
-- =====================================================

-- Drop all indexes in public schema (except primary keys)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'  -- Keep primary keys for now
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.indexname) || ' CASCADE';
        RAISE NOTICE 'Dropped index: % on %', r.indexname, r.tablename;
    END LOOP;
END $$;

-- Verify remaining indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public';
