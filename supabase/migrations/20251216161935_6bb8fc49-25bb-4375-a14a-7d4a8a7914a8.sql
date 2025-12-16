-- Move pg_net extension to extensions schema
-- Note: pg_net is used by Supabase for HTTP requests

-- First check if we can alter the extension schema
DO $$
BEGIN
  -- Try to move pg_net to extensions schema
  -- This may fail if objects depend on it
  ALTER EXTENSION pg_net SET SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not move pg_net to extensions schema: %', SQLERRM;
END $$;