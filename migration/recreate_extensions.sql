-- =============================================================================
-- SUPABASE MIGRATION: Recreate Extensions
-- Execute ANTES do pg_restore para garantir que todas extensions existam
-- =============================================================================

-- Extensions padrão do Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "plpgsql";

-- Extensions do schema public (se existirem)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- Extensions adicionais comuns
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Extensions para GIS (se necessário)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Extensions para Full Text Search
-- CREATE EXTENSION IF NOT EXISTS "pg_search";

-- =============================================================================
-- ROLES PADRÃO DO SUPABASE
-- =============================================================================

-- Criar roles se não existirem
DO $$
BEGIN
    -- anon role
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    
    -- authenticated role
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    
    -- service_role
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    
    -- supabase_admin
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    
    -- authenticator
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOLOGIN NOINHERIT;
    END IF;
END $$;

-- Conceder roles
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- =============================================================================
-- SCHEMAS PADRÃO DO SUPABASE
-- =============================================================================

-- Criar schemas se não existirem
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS supabase_functions;
CREATE SCHEMA IF NOT EXISTS pgsodium;
CREATE SCHEMA IF NOT EXISTS vault;

-- Permissões nos schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;

-- =============================================================================
-- CONFIGURAÇÕES DE SEARCH_PATH
-- =============================================================================

ALTER DATABASE postgres SET search_path TO public, extensions;

-- =============================================================================
-- LOG DE CONCLUSÃO
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Extensions e roles do Supabase recriados com sucesso!';
END $$;
