-- =====================================================
-- SCRIPT 4: DROP ALL CUSTOM TYPES
-- Target: Supabase Cloud (sdvyxdghxqmntyoweqbd)
-- Execute to remove all custom types and enums
-- =====================================================

-- Drop all enum types in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.typname as type_name,
               n.nspname as schema_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.typtype = 'e'  -- Enum types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.schema_name) || '.' || quote_ident(r.type_name) || ' CASCADE';
        RAISE NOTICE 'Dropped enum type: %', r.type_name;
    END LOOP;
END $$;

-- Drop all composite types in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.typname as type_name,
               n.nspname as schema_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.typtype = 'c'  -- Composite types
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c WHERE c.reltype = t.oid
        )  -- Exclude table row types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.schema_name) || '.' || quote_ident(r.type_name) || ' CASCADE';
        RAISE NOTICE 'Dropped composite type: %', r.type_name;
    END LOOP;
END $$;

-- Drop all domain types in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.typname as type_name,
               n.nspname as schema_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.typtype = 'd'  -- Domain types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.schema_name) || '.' || quote_ident(r.type_name) || ' CASCADE';
        RAISE NOTICE 'Dropped domain type: %', r.type_name;
    END LOOP;
END $$;

-- Drop all range types in public schema
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT t.typname as type_name,
               n.nspname as schema_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.typtype = 'r'  -- Range types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.schema_name) || '.' || quote_ident(r.type_name) || ' CASCADE';
        RAISE NOTICE 'Dropped range type: %', r.type_name;
    END LOOP;
END $$;

-- Verify no custom types remain
SELECT t.typname, t.typtype, n.nspname
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
AND t.typtype IN ('e', 'c', 'd', 'r');
