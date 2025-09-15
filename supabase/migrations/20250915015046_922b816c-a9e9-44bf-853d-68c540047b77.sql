-- Add murilloggomes@gmail.com as system administrator
INSERT INTO public.admins (email, password_hash, name, role)
VALUES (
  'murilloggomes@gmail.com',
  '$2b$10$X8pTBXu3gGrKM8YJ9Q6RVe8qJk4M6L7H9mE2tYqWvXpUwN5oCzVzi', -- Default password: admin123
  'Murillo Gomes',
  'admin'
) ON CONFLICT (email) DO NOTHING;