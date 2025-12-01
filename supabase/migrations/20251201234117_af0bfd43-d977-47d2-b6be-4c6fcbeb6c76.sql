-- Atualizar função is_admin() para incluir master
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role IN ('admin'::app_role, 'master'::app_role)
  )
$$;

-- Criar função auxiliar is_admin_or_master() para reutilização
CREATE OR REPLACE FUNCTION public.is_admin_or_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'master'::app_role)
  )
$$;

-- Remover políticas antigas de profiles
DROP POLICY IF EXISTS "admins_full_access_profiles" ON public.profiles;

-- Criar nova política para profiles que verifica admin OU master
CREATE POLICY "admins_full_access_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin'::app_role, 'master'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin'::app_role, 'master'::app_role)
  )
);

-- Remover políticas antigas de user_roles
DROP POLICY IF EXISTS "admins_full_access_user_roles" ON public.user_roles;

-- Criar nova política para user_roles que verifica admin OU master
CREATE POLICY "admins_full_access_user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin'::app_role, 'master'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin'::app_role, 'master'::app_role)
  )
);