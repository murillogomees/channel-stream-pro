-- ============================================
-- FIX #1: Add INSERT policies for monitoring tables
-- ============================================

-- Allow authenticated users (service role) to insert health snapshots
CREATE POLICY "Service can insert health snapshots"
ON public.health_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users (service role) to insert metrics snapshots
CREATE POLICY "Service can insert metrics snapshots"
ON public.metrics_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- FIX #2: Add SET search_path to SECURITY DEFINER functions
-- ============================================

-- Fix get_auth_uid function
CREATE OR REPLACE FUNCTION public.get_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.uid())::uuid;
$$;

-- Fix has_role function
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

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(uid, 'admin'::app_role);
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, telefone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.raw_user_meta_data->>'telefone',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Fix handle_new_user_role function
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix ensure_single_default_m3u function
CREATE OR REPLACE FUNCTION public.ensure_single_default_m3u()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.m3u_lists 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix cleanup_old_metrics function
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.metrics_snapshots 
  WHERE timestamp < now() - interval '30 days';
  
  DELETE FROM public.health_snapshots 
  WHERE timestamp < now() - interval '30 days';
END;
$$;

-- Fix custom_access_token_hook function
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Buscar o role do usuário (prioriza admin)
  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = (event->>'user_id')::uuid
  ORDER BY (ur.role = 'admin') DESC
  LIMIT 1;

  -- Adicionar user_role ao JWT
  IF user_role IS NOT NULL THEN
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(user_role));
  END IF;

  RETURN event;
END;
$$;

-- ============================================
-- FIX #3: Enable RLS on rls_policy_backups table
-- ============================================

ALTER TABLE public.rls_policy_backups ENABLE ROW LEVEL SECURITY;

-- Add admin-only access policy
CREATE POLICY "Admins can manage RLS policy backups"
ON public.rls_policy_backups
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- COMMENTS: Document the security fixes
-- ============================================

COMMENT ON POLICY "Service can insert health snapshots" ON public.health_snapshots IS 
'Allows authenticated service role to insert health monitoring data. Fixes RLS violation errors.';

COMMENT ON POLICY "Service can insert metrics snapshots" ON public.metrics_snapshots IS 
'Allows authenticated service role to insert metrics data. Fixes RLS violation errors.';

COMMENT ON POLICY "Admins can manage RLS policy backups" ON public.rls_policy_backups IS 
'Admin-only access to RLS policy backups table. Prevents privilege escalation.';
