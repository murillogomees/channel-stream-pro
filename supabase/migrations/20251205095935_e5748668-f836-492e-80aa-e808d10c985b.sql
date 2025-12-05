-- Add explicit SELECT policy for m3u_channels (policy ALL can have issues)
DROP POLICY IF EXISTS "Admins and masters full access m3u_channels" ON m3u_channels;

-- Create explicit policies for each operation
CREATE POLICY "Admins masters select m3u_channels"
  ON m3u_channels FOR SELECT
  USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins masters insert m3u_channels"
  ON m3u_channels FOR INSERT
  WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins masters update m3u_channels"
  ON m3u_channels FOR UPDATE
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));

CREATE POLICY "Admins masters delete m3u_channels"
  ON m3u_channels FOR DELETE
  USING (is_admin_or_master(auth.uid()));