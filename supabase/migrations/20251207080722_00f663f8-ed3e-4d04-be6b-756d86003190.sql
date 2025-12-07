-- Fix infinite recursion - drop triggers first with CASCADE

-- Drop the auth.users trigger that's causing recursion
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Now drop functions with CASCADE
DROP FUNCTION IF EXISTS public.sync_auth_user_to_profile() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_to_auth_user() CASCADE;

-- Drop profile trigger too
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

-- Create improved sync function from profile to auth.users
-- Only syncs specific field changes, with recursion guard
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync if email, contact_phone or nome actually changed
  IF (OLD.email IS DISTINCT FROM NEW.email) OR 
     (OLD.contact_phone IS DISTINCT FROM NEW.contact_phone) OR
     (OLD.nome IS DISTINCT FROM NEW.nome) THEN
    
    UPDATE auth.users
    SET 
      email = COALESCE(NEW.email, email),
      phone = COALESCE(NEW.contact_phone, phone),
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{full_name}',
        to_jsonb(COALESCE(NEW.nome, ''))
      ),
      updated_at = now()
    WHERE id = NEW.id
    AND (
      email IS DISTINCT FROM COALESCE(NEW.email, email) OR
      phone IS DISTINCT FROM COALESCE(NEW.contact_phone, phone) OR
      raw_user_meta_data->>'full_name' IS DISTINCT FROM COALESCE(NEW.nome, '')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the profile update trigger (only fires on specific field changes)
CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.contact_phone IS DISTINCT FROM NEW.contact_phone OR
    OLD.nome IS DISTINCT FROM NEW.nome
  )
  EXECUTE FUNCTION public.sync_profile_to_auth_user();

-- For auth.users -> profiles sync, we only need it on INSERT (new user creation)
-- Updates to auth.users (like last_sign_in) should NOT trigger profile updates
CREATE OR REPLACE FUNCTION public.sync_new_auth_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, contact_phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Only trigger on INSERT, not UPDATE (prevents recursion on login)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_new_auth_user_to_profile();