-- ============================================
-- TRIGGER COMPLETO: Criar profile + role ao registrar usuário
-- Garante que cada usuário tenha EXATAMENTE 1 role
-- ============================================

-- Dropar trigger e função antiga para recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar função robusta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- 1. Criar profile vinculado ao auth.users.id
  INSERT INTO public.profiles (id, email, nome, contact_phone, origem_cadastro)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefone',
    COALESCE(NEW.raw_user_meta_data->>'origem_cadastro', 'Website')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    updated_at = now();

  -- 2. Criar role 'client' (cada usuário só pode ter UMA role)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT ON CONSTRAINT user_roles_one_role_per_user DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block signup
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Criar trigger que executa após inserção em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Garantir constraint de uma role por usuário existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_one_role_per_user'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_one_role_per_user UNIQUE (user_id);
  END IF;
END $$;