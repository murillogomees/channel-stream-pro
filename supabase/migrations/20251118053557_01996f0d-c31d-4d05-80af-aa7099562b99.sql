-- Ensure Murillo remains admin and prevent future regressions
-- 1) Guarantee admin role exists for the primary admin (by email)
WITH primary_admin AS (
  SELECT id FROM public.profiles WHERE email = 'murillo@gmail.com'
)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM primary_admin
ON CONFLICT DO NOTHING;

-- 2) Enforce uniqueness of roles per user (safe no-op if already unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique ON public.user_roles (user_id, role);

-- 3) Trigger: protect the primary admin from being demoted or having admin removed
CREATE OR REPLACE FUNCTION public.protect_primary_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  primary_admin_id uuid;
BEGIN
  SELECT id INTO primary_admin_id FROM public.profiles WHERE email = 'murillo@gmail.com' LIMIT 1;

  IF primary_admin_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; -- nothing to protect if not found
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id = primary_admin_id AND OLD.role = 'admin' THEN
      RAISE EXCEPTION 'Não é permitido remover a role admin do administrador principal';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_id = primary_admin_id AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      RAISE EXCEPTION 'Não é permitido rebaixar o administrador principal';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_primary_admin ON public.user_roles;
CREATE TRIGGER a_protect_primary_admin
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.protect_primary_admin();

-- 4) Trigger: prevent removing the last remaining admin in the system
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_admins int;
  resulting_admins int;
BEGIN
  SELECT COUNT(*) INTO current_admins FROM public.user_roles WHERE role = 'admin';

  -- Calculate resulting admins after this operation
  resulting_admins := current_admins;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' THEN
      resulting_admins := current_admins - 1;
    END IF;
    IF resulting_admins <= 0 THEN
      RAISE EXCEPTION 'Operação proibida: o sistema deve manter pelo menos um administrador';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      resulting_admins := current_admins - 1;
      IF resulting_admins <= 0 THEN
        RAISE EXCEPTION 'Operação proibida: o sistema deve manter pelo menos um administrador';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS b_prevent_last_admin_removal ON public.user_roles;
CREATE TRIGGER b_prevent_last_admin_removal
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_removal();