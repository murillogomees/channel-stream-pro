-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins full access m3u_channels" ON m3u_channels;

-- Create new policy that includes both admin and master roles
CREATE POLICY "Admins and masters full access m3u_channels" 
ON m3u_channels 
FOR ALL 
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));