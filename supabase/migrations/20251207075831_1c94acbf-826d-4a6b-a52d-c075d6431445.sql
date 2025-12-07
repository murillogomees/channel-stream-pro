-- ============================================
-- STEP 1: Archive orphan profiles before FK constraint
-- ============================================

-- Create archive table for orphan profiles
CREATE TABLE IF NOT EXISTS public.profiles_orphan_archive (
  id uuid PRIMARY KEY,
  original_data jsonb NOT NULL,
  archived_at timestamptz DEFAULT now(),
  reason text DEFAULT 'no_matching_auth_user'
);

-- Archive orphan profiles
INSERT INTO public.profiles_orphan_archive (id, original_data)
SELECT p.id, row_to_json(p)::jsonb
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- Delete orphan profiles
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- ============================================
-- STEP 2: Now safely add FK constraint
-- ============================================
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- STEP 3: Create views for auth integration
-- ============================================

-- View: Profile identities
CREATE OR REPLACE VIEW public.profile_identities AS
SELECT 
  p.id as profile_id,
  p.nome,
  p.email as profile_email,
  i.id as identity_id,
  i.provider,
  i.identity_data,
  i.created_at as identity_created_at,
  i.updated_at as identity_updated_at,
  i.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.identities i ON i.user_id = p.id;

-- View: Profile sessions
CREATE OR REPLACE VIEW public.profile_sessions AS
SELECT 
  p.id as profile_id,
  p.nome,
  p.email,
  s.id as session_id,
  s.created_at as session_created_at,
  s.updated_at as session_updated_at,
  s.factor_id,
  s.aal,
  s.not_after,
  s.refreshed_at,
  s.user_agent,
  s.ip
FROM public.profiles p
LEFT JOIN auth.sessions s ON s.user_id = p.id;

-- ============================================
-- STEP 4: Full profile with auth data function
-- ============================================
CREATE OR REPLACE FUNCTION public.get_profile_with_auth(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profile', row_to_json(p.*),
    'auth_user', jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'email_confirmed_at', u.email_confirmed_at,
      'phone', u.phone,
      'phone_confirmed_at', u.phone_confirmed_at,
      'created_at', u.created_at,
      'updated_at', u.updated_at,
      'last_sign_in_at', u.last_sign_in_at,
      'role', u.role,
      'is_sso_user', u.is_sso_user,
      'is_anonymous', u.is_anonymous
    ),
    'identities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'provider', i.provider,
        'identity_data', i.identity_data,
        'last_sign_in_at', i.last_sign_in_at
      ))
      FROM auth.identities i WHERE i.user_id = p_user_id
    ), '[]'::jsonb),
    'active_sessions', (
      SELECT COUNT(*) FROM auth.sessions s 
      WHERE s.user_id = p_user_id 
        AND (s.not_after IS NULL OR s.not_after > now())
    ),
    'roles', COALESCE((
      SELECT jsonb_agg(r.role) FROM public.user_roles r WHERE r.user_id = p_user_id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;
  
  RETURN result;
END;
$$;

-- ============================================
-- STEP 5: Enhanced sync triggers
-- ============================================

-- Profiles -> auth.users sync
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET 
    email = COALESCE(NEW.email, auth.users.email),
    phone = COALESCE(NEW.contact_phone, NEW.telefone, auth.users.phone),
    raw_user_meta_data = jsonb_build_object(
      'full_name', COALESCE(NEW.nome, ''),
      'nome', COALESCE(NEW.nome, ''),
      'telefone', COALESCE(NEW.telefone, ''),
      'plano', COALESCE(NEW.plano::text, ''),
      'situacao', COALESCE(NEW.situacao::text, ''),
      'cliente_ativo', COALESCE(NEW.cliente_ativo, false)
    ) || COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb),
    updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated_sync_auth ON public.profiles;
CREATE TRIGGER on_profile_updated_sync_auth
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_auth_user();

-- auth.users -> Profiles sync
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, telefone, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'telefone'),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(EXCLUDED.nome, ''), profiles.nome),
    telefone = COALESCE(EXCLUDED.telefone, profiles.telefone),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated_sync_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_profile
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_profile();

-- ============================================
-- STEP 6: Session management functions
-- ============================================

CREATE OR REPLACE FUNCTION public.invalidate_profile_sessions(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT is_admin_or_master(auth.uid()) AND auth.uid() != p_profile_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM auth.sessions WHERE user_id = p_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  INSERT INTO activity_logs (user_id, action_type, action_description, entity_type, entity_id)
  VALUES (auth.uid(), 'session_invalidation', 'All sessions invalidated', 'profile', p_profile_id::text);
  
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_auth_status(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profile_id', p.id,
    'email_confirmed', u.email_confirmed_at IS NOT NULL,
    'phone_confirmed', u.phone_confirmed_at IS NOT NULL,
    'last_sign_in', u.last_sign_in_at,
    'mfa_enabled', EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p.id AND f.status = 'verified'),
    'active_sessions', (SELECT COUNT(*) FROM auth.sessions s WHERE s.user_id = p.id AND (s.not_after IS NULL OR s.not_after > now())),
    'identity_providers', (SELECT array_agg(DISTINCT provider) FROM auth.identities i WHERE i.user_id = p.id),
    'account_created', u.created_at,
    'subscription_status', p.situacao,
    'subscription_expires', p.data_vencimento,
    'is_active', p.cliente_ativo
  ) INTO result
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_profile_id;
  
  RETURN result;
END;
$$;

-- ============================================
-- STEP 7: Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_contact_phone ON public.profiles(contact_phone);
CREATE INDEX IF NOT EXISTS idx_profiles_cliente_ativo ON public.profiles(cliente_ativo);
CREATE INDEX IF NOT EXISTS idx_profiles_situacao ON public.profiles(situacao);
CREATE INDEX IF NOT EXISTS idx_profiles_data_vencimento ON public.profiles(data_vencimento);

-- ============================================
-- STEP 8: RLS for archive table
-- ============================================
ALTER TABLE public.profiles_orphan_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and masters manage orphan archive"
ON public.profiles_orphan_archive FOR ALL
USING (is_admin_or_master(auth.uid()));