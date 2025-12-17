-- Fix recursive policy on public.user_roles (avoid referencing user_roles inside its own policy)

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin_or_master(auth.uid()))
WITH CHECK (public.is_admin_or_master(auth.uid()));
