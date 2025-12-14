-- =====================================================
-- SCRIPT 5: DROP ALL TRIGGERS
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute to remove all triggers
-- =====================================================

-- Drop all triggers on tables in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE';
        RAISE NOTICE 'Dropped trigger: % on %', r.trigger_name, r.event_object_table;
    END LOOP;
END $$;

-- Verify no triggers remain
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
