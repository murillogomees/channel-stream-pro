
-- Ensure app_role enum has all required values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('client', 'admin', 'master');
  END IF;
END$$;

-- Ensure user_roles table exists with proper structure
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create helper function to check if user is master (bypasses all checks)
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'master'::app_role
  )
$$;

-- Recreate is_admin_or_master with proper logic
CREATE OR REPLACE FUNCTION public.is_admin_or_master(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'master'::app_role)
  )
$$;

-- Create has_role function for granular checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles table
-- Everyone can view their own roles
CREATE POLICY "user_roles_select_own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Master and Admin can view all roles
CREATE POLICY "user_roles_select_admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_admin_or_master(auth.uid()));

-- Only master can insert any role, admin can only insert 'client'
CREATE POLICY "user_roles_insert_policy"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  is_master(auth.uid()) OR 
  (is_admin_or_master(auth.uid()) AND role = 'client'::app_role)
);

-- Only master can update roles
CREATE POLICY "user_roles_update_policy"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (is_master(auth.uid()));

-- Only master can delete roles
CREATE POLICY "user_roles_delete_policy"
ON public.user_roles
FOR DELETE
TO authenticated
USING (is_master(auth.uid()));

-- Update custom_access_token_hook to properly set role in JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_role text;
  user_uuid uuid;
BEGIN
  user_uuid := (event->>'user_id')::uuid;
  
  -- Priority: master > admin > client
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = user_uuid AND role = 'master'::app_role
    ) THEN 'master'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = user_uuid AND role = 'admin'::app_role
    ) THEN 'admin'
    ELSE 'client'
  END INTO app_user_role;

  -- Keep Postgres role as 'authenticated' for RLS
  event := jsonb_set(event, '{claims,role}', to_jsonb('authenticated'::text));

  -- Add custom claim for app role
  event := jsonb_set(event, '{claims,user_role}', to_jsonb(app_user_role), true);
  
  -- Add is_master flag for convenience
  event := jsonb_set(event, '{claims,is_master}', to_jsonb(app_user_role = 'master'), true);

  RETURN event;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_master TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_master TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Ensure supabase_auth_admin can read user_roles for the hook
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
