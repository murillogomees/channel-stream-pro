-- Atualizar senha do usuário master murillo@gmail.com
UPDATE auth.users 
SET 
  encrypted_password = crypt('@Cla24749@', gen_salt('bf')),
  updated_at = now()
WHERE email = 'murillo@gmail.com';

-- Verificar se o usuário existe, se não, criar
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
SELECT
  gen_random_uuid(),
  'murillo@gmail.com',
  crypt('@Cla24749@', gen_salt('bf')),
  now(),
  now(),
  now(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Murillo - Master"}'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'murillo@gmail.com');

-- Garantir que o perfil existe
INSERT INTO public.profiles (id, email, nome, cliente_ativo, situacao, created_at, updated_at)
SELECT 
  u.id,
  'murillo@gmail.com',
  'Murillo - Master',
  true,
  'Ativo',
  now(),
  now()
FROM auth.users u
WHERE u.email = 'murillo@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  nome = 'Murillo - Master',
  cliente_ativo = true,
  situacao = 'Ativo',
  updated_at = now();

-- Garantir role master
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'master'
FROM auth.users u
WHERE u.email = 'murillo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;