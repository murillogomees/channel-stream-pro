-- Secure mobile_sessions RLS by removing public full access and restricting operations
-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.mobile_sessions ENABLE ROW LEVEL SECURITY;

-- 2) Remove overly permissive policy
DROP POLICY IF EXISTS "Anyone can manage mobile sessions" ON public.mobile_sessions;

-- 3) Allow only creation by anonymous/authenticated clients (no read/update/delete)
CREATE POLICY "Public can create mobile sessions"
ON public.mobile_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 4) Allow admins to fully manage records
CREATE POLICY "Admins can manage all mobile sessions"
ON public.mobile_sessions
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());