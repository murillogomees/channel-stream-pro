-- Helper functions to derive current email and admin check
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select (auth.jwt() ->> 'email')::text
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.admins a
    where (a.id = auth.uid() or a.email = public.current_email())
  )
$$;

-- Update admins RLS to allow select by email or id, and restrict modifications to own row
DROP POLICY IF EXISTS "Admins can manage their own data" ON public.admins;
DROP POLICY IF EXISTS "Admin can select own row by id or email" ON public.admins;
DROP POLICY IF EXISTS "Admin can update own row" ON public.admins;
DROP POLICY IF EXISTS "Admin can insert own row" ON public.admins;
DROP POLICY IF EXISTS "Admin can delete own row" ON public.admins;

CREATE POLICY "Admin can select own row by id or email"
ON public.admins
FOR SELECT
USING (id = auth.uid() OR email = public.current_email());

CREATE POLICY "Admin can update own row"
ON public.admins
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can insert own row"
ON public.admins
FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can delete own row"
ON public.admins
FOR DELETE
USING (id = auth.uid());

-- Allow admins (by id or email) to manage key tables
DROP POLICY IF EXISTS "Super admins can manage M3U lists" ON public.m3u_lists;
DROP POLICY IF EXISTS "Admins can manage M3U lists" ON public.m3u_lists;
CREATE POLICY "Admins can manage M3U lists"
ON public.m3u_lists
FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Super admins can manage affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Admins can manage affiliates" ON public.affiliates;
CREATE POLICY "Admins can manage affiliates"
ON public.affiliates
FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Super admins can manage all affiliate sales" ON public.affiliate_sales;
DROP POLICY IF EXISTS "Admins can manage all affiliate sales" ON public.affiliate_sales;
CREATE POLICY "Admins can manage all affiliate sales"
ON public.affiliate_sales
FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Super admins can manage all players" ON public.recommended_players;
DROP POLICY IF EXISTS "Admins can manage players" ON public.recommended_players;
CREATE POLICY "Admins can manage players"
ON public.recommended_players
FOR ALL
USING (public.is_admin());