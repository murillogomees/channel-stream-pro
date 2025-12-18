-- Security hardening: move extensions out of public + lock down materialized views

-- 1) Move extensions from public -> extensions schema (as recommended by linter)
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', r.extname);
    EXCEPTION WHEN OTHERS THEN
      -- If an extension cannot be moved, skip it.
      NULL;
    END;
  END LOOP;
END $$;

-- Ensure common UUID function remains available in public even after moving pgcrypto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions' AND p.proname = 'gen_random_uuid'
  ) THEN
    EXECUTE 'CREATE OR REPLACE FUNCTION public.gen_random_uuid() RETURNS uuid LANGUAGE sql AS ''SELECT extensions.gen_random_uuid()''';
  END IF;
END $$;

-- 2) Materialized views should not be exposed via Data APIs; revoke anon/authenticated access
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon, authenticated', r.schemaname, r.matviewname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;