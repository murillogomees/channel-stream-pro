-- =====================================================
-- SCRIPT 7: DROP ALL SEQUENCES
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute to remove all sequences
-- =====================================================

-- Drop all sequences in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    ) LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
        RAISE NOTICE 'Dropped sequence: %', r.sequence_name;
    END LOOP;
END $$;

-- Verify no sequences remain
SELECT sequence_name 
FROM information_schema.sequences 
WHERE sequence_schema = 'public';
