-- Recreate is_admin_or_master as SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION is_admin_or_master(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'master'::app_role)
  )
$$;