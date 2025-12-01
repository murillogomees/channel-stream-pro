-- Corrigir recursão infinita: usar funções SECURITY DEFINER ao invés de EXISTS queries

-- Remover políticas problemáticas de profiles
DROP POLICY IF EXISTS "admins_full_access_profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

-- Criar políticas corretas para profiles usando funções SECURITY DEFINER
CREATE POLICY "admins_full_access_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin_or_master(auth.uid()))
WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "users_view_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Remover políticas problemáticas de user_roles
DROP POLICY IF EXISTS "admins_full_access_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_view_own_roles" ON public.user_roles;

-- Criar políticas corretas para user_roles usando funções SECURITY DEFINER
CREATE POLICY "admins_full_access_user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin_or_master(auth.uid()))
WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "users_view_own_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);