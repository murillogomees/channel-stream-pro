-- =============================================================================
-- Attempt to move pg_net extension to extensions schema
-- Note: pg_net is a Supabase-managed extension for HTTP requests
-- =============================================================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Try to move pg_net to extensions schema
DO $$
BEGIN
  -- Check current schema of pg_net
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_net' AND n.nspname = 'public'
  ) THEN
    -- Attempt to alter the extension schema
    BEGIN
      ALTER EXTENSION pg_net SET SCHEMA extensions;
      RAISE NOTICE 'Successfully moved pg_net to extensions schema';
    EXCEPTION
      WHEN OTHERS THEN
        -- If it fails, it's likely due to Supabase managing this extension
        RAISE WARNING 'Could not move pg_net to extensions schema: %. This is expected for Supabase-managed extensions.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_net is not in public schema or does not exist';
  END IF;
END $$;

-- Verify final state
DO $$
DECLARE
  ext_schema TEXT;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'pg_net';
  
  IF ext_schema IS NOT NULL THEN
    RAISE NOTICE 'pg_net is currently in schema: %', ext_schema;
  END IF;
END $$;