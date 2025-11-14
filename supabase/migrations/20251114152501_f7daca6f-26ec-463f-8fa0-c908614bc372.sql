-- 1. Atualizar o enum app_role para ter apenas client e admin
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('client', 'admin');

-- 2. Atualizar a tabela user_roles com o novo tipo
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role 
  USING CASE 
    WHEN role::text = 'admin' THEN 'admin'::public.app_role
    ELSE 'client'::public.app_role
  END;

-- 3. Remover o enum antigo com CASCADE (vai remover dependências e recriar)
DROP TYPE public.app_role_old CASCADE;

-- 4. Recriar a função has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

-- 5. Recriar políticas RLS que foram dropadas
-- M3U Lists
CREATE POLICY "Admins podem gerenciar listas M3U"
ON public.m3u_lists
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Clientes
CREATE POLICY "Admins podem gerenciar clientes"
ON public.clientes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Notification Templates
CREATE POLICY "Admins podem gerenciar templates"
ON public.notification_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Notification Logs
CREATE POLICY "Admins podem visualizar logs"
ON public.notification_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin Phones
CREATE POLICY "Admins podem gerenciar telefones"
ON public.admin_phones
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Metrics Snapshots
CREATE POLICY "Admins podem visualizar métricas"
ON public.metrics_snapshots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Health Snapshots
CREATE POLICY "Admins podem visualizar health"
ON public.health_snapshots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- User Roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Storage: M3U Files bucket
CREATE POLICY "Admins podem fazer upload de M3U"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'm3U Files' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'm3U Files' AND public.has_role(auth.uid(), 'admin'));

-- 6. Criar trigger para garantir que novos usuários recebam role "client" automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();