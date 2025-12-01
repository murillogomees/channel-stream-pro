
-- Limpar roles duplicadas e antigas
DELETE FROM user_roles WHERE role = 'super_admin'::app_role;
DELETE FROM user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'murilloggomes@gmail.com') AND role = 'client';
