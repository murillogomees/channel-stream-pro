-- Atualizar senha do usuário Murillo@iptvlink.com.br
UPDATE auth.users 
SET 
  encrypted_password = crypt('@Cla24749@', gen_salt('bf')),
  updated_at = now()
WHERE email = 'Murillo@iptvlink.com.br';

-- Verificar se foi atualizado
SELECT id, email, updated_at FROM auth.users WHERE email = 'Murillo@iptvlink.com.br';