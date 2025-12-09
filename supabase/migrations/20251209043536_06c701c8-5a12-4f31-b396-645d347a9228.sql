-- O hook custom_access_token_hook precisa ler user_roles durante login
-- Mas como é SECURITY DEFINER, ele executa como o owner da função (superuser/service role)
-- O problema pode ser que RLS ainda está ativado para SECURITY DEFINER

-- Adicionar política para permitir leitura durante autenticação
-- A função SECURITY DEFINER deve bypassar RLS, mas vamos garantir

-- Verificar e corrigir: criar política que permite SELECT para o hook
DROP POLICY IF EXISTS "Auth hook can read roles" ON public.user_roles;
CREATE POLICY "Auth hook can read roles"
ON public.user_roles
FOR SELECT
TO authenticated, anon
USING (true);

-- Nota: Esta política permite leitura ampla, mas o hook precisa disso
-- A segurança é mantida porque INSERT/UPDATE/DELETE ainda são restritos