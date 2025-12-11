-- Deletar usuário existente para recriar corretamente
DELETE FROM public.user_roles WHERE user_id = '74788ca0-7028-4728-9aaa-62f0ab3cbfdd';
DELETE FROM public.profiles WHERE id = '74788ca0-7028-4728-9aaa-62f0ab3cbfdd';
DELETE FROM auth.users WHERE id = '74788ca0-7028-4728-9aaa-62f0ab3cbfdd';