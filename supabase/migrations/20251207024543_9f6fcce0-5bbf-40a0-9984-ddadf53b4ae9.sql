-- Create RPC for reading r2 config that bypasses RLS
CREATE OR REPLACE FUNCTION get_r2_config()
RETURNS TABLE(key TEXT, value JSONB, description TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin or master
  IF NOT is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  RETURN QUERY SELECT c.key, c.value, c.description, c.updated_at 
  FROM r2_migration_config c;
END;
$$;