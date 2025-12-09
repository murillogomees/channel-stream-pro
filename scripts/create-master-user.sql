-- Script: Create Master User for Self-Hosted Supabase
-- Execute with: docker exec -it supabase-db psql -U postgres -d postgres -f /path/to/create-master-user.sql
-- Or copy and paste into psql

-- 1. Create user in auth.users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  instance_id,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'murillo@iptvlink.com.br',
  crypt('@Cla24749@', gen_salt('bf')),
  now(),
  now(),
  now(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Murillo - Master"}'
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('@Cla24749@', gen_salt('bf')),
  updated_at = now();

-- 2. Create profile in profiles table
INSERT INTO public.profiles (
  id,
  email,
  nome,
  cliente_ativo,
  situacao,
  created_at,
  updated_at
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'murillo@iptvlink.com.br',
  'Murillo - Master',
  true,
  'Ativo',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  nome = 'Murillo - Master',
  cliente_ativo = true,
  situacao = 'Ativo',
  updated_at = now();

-- 3. Assign master role
INSERT INTO public.user_roles (user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'master')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify creation
SELECT 'auth.users' as table_name, id, email FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'profiles', id, email FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000001';

SELECT 'user_roles' as table_name, user_id::text, role::text FROM public.user_roles WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
