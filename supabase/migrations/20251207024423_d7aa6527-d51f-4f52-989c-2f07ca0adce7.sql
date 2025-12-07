-- Drop existing policy
DROP POLICY IF EXISTS "Admin full access r2_migration_config" ON r2_migration_config;

-- Create more permissive policies for r2_migration_config
-- SELECT policy - allow admin/master
CREATE POLICY "r2_migration_config_select" 
ON r2_migration_config 
FOR SELECT 
USING (is_admin_or_master(auth.uid()));

-- UPDATE policy - allow admin/master  
CREATE POLICY "r2_migration_config_update" 
ON r2_migration_config 
FOR UPDATE 
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

-- INSERT policy - allow admin/master
CREATE POLICY "r2_migration_config_insert" 
ON r2_migration_config 
FOR INSERT 
WITH CHECK (is_admin_or_master(auth.uid()));

-- Create a SECURITY DEFINER function for updating config
CREATE OR REPLACE FUNCTION update_r2_config(p_key TEXT, p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin or master
  IF NOT is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE r2_migration_config 
  SET value = p_value, updated_at = now(), updated_by = auth.uid()
  WHERE key = p_key;
  
  RETURN FOUND;
END;
$$;