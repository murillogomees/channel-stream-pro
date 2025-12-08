-- =====================================================
-- MIGRAÇÃO: Criar roles admin e master para self-hosted
-- =====================================================

-- Criar role admin se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin NOLOGIN;
  END IF;
END
$$;

-- Criar role master se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'master') THEN
    CREATE ROLE master NOLOGIN;
  END IF;
END
$$;

-- Garantir que admin herda de authenticated
GRANT authenticated TO admin;
GRANT anon TO admin;

-- Garantir que master herda de admin
GRANT admin TO master;

-- Permissões para admin no schema public
GRANT USAGE ON SCHEMA public TO admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO admin;

-- Permissões para master no schema public
GRANT USAGE ON SCHEMA public TO master;
GRANT ALL ON ALL TABLES IN SCHEMA public TO master;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO master;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO master;

-- Permissões default para futuras tabelas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO master;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO master;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO master;