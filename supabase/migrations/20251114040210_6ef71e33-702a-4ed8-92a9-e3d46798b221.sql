-- ============================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- Fixes: Missing profiles table, user_id column, RLS policies
-- ============================================

-- 1. Drop broken trigger and function FIRST (with CASCADE)
DROP FUNCTION IF EXISTS public.sync_client_on_mac_update() CASCADE;

-- 2. Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Add user_id column to clientes table
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);

-- 4. Create trigger function to auto-create profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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

-- Create trigger to execute function on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Add RLS policies for profiles table
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- 6. Add user-level RLS policies for clientes table
CREATE POLICY "Users can view own client data"
ON public.clientes FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own contact info"
ON public.clientes FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() AND
  -- Prevent users from modifying critical fields
  cliente_ativo = (SELECT cliente_ativo FROM public.clientes WHERE id = clientes.id) AND
  smartone_status = (SELECT smartone_status FROM public.clientes WHERE id = clientes.id) AND
  valor_pago = (SELECT valor_pago FROM public.clientes WHERE id = clientes.id)
);

-- 7. Drop obsolete tables
DROP TABLE IF EXISTS public.activation_keys CASCADE;
DROP TABLE IF EXISTS public.app_users CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.admins CASCADE;

-- 8. Drop obsolete functions
DROP FUNCTION IF EXISTS public.generate_activation_keys(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.validate_activation_key(text) CASCADE;
DROP FUNCTION IF EXISTS public.activate_device(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.check_device_subscription(text) CASCADE;