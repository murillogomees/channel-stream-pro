
-- Remover roles duplicadas mantendo apenas a de maior prioridade (master > admin > client)
-- Primeiro, garantir que cada usuário tenha apenas uma role

-- 1. Criar função para determinar prioridade da role
CREATE OR REPLACE FUNCTION get_role_priority(role_name text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN role_name = 'master' THEN 3
    WHEN role_name = 'admin' THEN 2
    WHEN role_name = 'client' THEN 1
    ELSE 0
  END;
$$;

-- 2. Remover roles duplicadas, mantendo apenas a de maior prioridade
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id 
  AND get_role_priority(a.role::text) < get_role_priority(b.role::text);

-- 3. Criar constraint UNIQUE para garantir apenas uma role por usuário
-- Primeiro remover a constraint existente se houver
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Adicionar nova constraint: um usuário só pode ter UMA role
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_one_role_per_user UNIQUE (user_id);
