-- Atualizar role do murillo@gmail.com para master
UPDATE public.user_roles 
SET role = 'master' 
WHERE user_id = '43fdc4bb-f9df-4c21-8fc2-242414c487b4';
