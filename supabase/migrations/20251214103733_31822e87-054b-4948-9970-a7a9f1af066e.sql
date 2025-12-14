-- Inserir role master para murillocasarini@gmail.com (usuário mais recente logado)
INSERT INTO public.user_roles (user_id, role)
VALUES ('111e2591-ccd2-4699-b695-900d3284ea10', 'master')
ON CONFLICT (user_id, role) DO NOTHING;

-- Garantir que também tem role master no user murillo@gmail.com 
INSERT INTO public.user_roles (user_id, role)
VALUES ('43fdc4bb-f9df-4c21-8fc2-242414c487b4', 'master')
ON CONFLICT (user_id, role) DO NOTHING;