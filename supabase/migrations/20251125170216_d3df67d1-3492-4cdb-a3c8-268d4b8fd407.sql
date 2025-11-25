-- Adicionar role super_admin para murillo@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'super_admin'::app_role
FROM public.profiles p
WHERE p.email = 'murillo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;