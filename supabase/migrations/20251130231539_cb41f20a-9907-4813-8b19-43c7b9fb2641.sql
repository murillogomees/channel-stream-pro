
-- Add super_admin role to rene@iptvlink.com.br
INSERT INTO public.user_roles (user_id, role)
VALUES ('d4b2afae-263f-4c3e-a2d6-cac7727219d2', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
