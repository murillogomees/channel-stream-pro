-- Fix RLS policy for r2_migration_config to allow updates
DROP POLICY IF EXISTS "Admin access r2_migration_config" ON r2_migration_config;

CREATE POLICY "Admin full access r2_migration_config" 
ON r2_migration_config 
FOR ALL 
TO public
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));