-- Trigger function to sync profiles changes to auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sync if email or name changed
  IF NEW.email IS DISTINCT FROM OLD.email OR NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE auth.users
    SET 
      email = COALESCE(NEW.email, auth.users.email),
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{full_name}',
        to_jsonb(COALESCE(NEW.nome, ''))
      ),
      updated_at = now()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_profile_updated_sync_auth ON public.profiles;

-- Create trigger to sync on profile update
CREATE TRIGGER on_profile_updated_sync_auth
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_auth_user();

-- Also create reverse sync: when auth.users changes, update profiles
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profile with auth.users data
  UPDATE public.profiles
  SET 
    email = NEW.email,
    nome = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.nome),
    updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_profile ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_updated_sync_profile
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_profile();