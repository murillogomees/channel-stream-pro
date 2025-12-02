-- Allow both admin and master roles to fully manage admin_phones (security alert admins)
CREATE POLICY "Admins and masters full access admin_phones"
ON public.admin_phones
FOR ALL
USING (is_admin_or_master(auth.uid()));