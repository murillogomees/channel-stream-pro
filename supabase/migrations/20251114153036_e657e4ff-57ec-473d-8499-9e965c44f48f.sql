-- Adicionar role de admin para murillo@gmail.com
-- User ID: 7f136599-d816-48a9-afcd-30f9f67580ce

-- Primeiro, remover role 'client' se existir
DELETE FROM public.user_roles 
WHERE user_id = '7f136599-d816-48a9-afcd-30f9f67580ce' 
AND role = 'client';

-- Adicionar role 'admin'
INSERT INTO public.user_roles (user_id, role)
VALUES ('7f136599-d816-48a9-afcd-30f9f67580ce', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;