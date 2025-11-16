-- Corrigir RLS policy da tabela health_snapshots para permitir inserção sem autenticação
-- Isso é necessário porque o serviço de métricas precisa salvar dados automaticamente

DROP POLICY IF EXISTS "Service can insert health snapshots" ON public.health_snapshots;

CREATE POLICY "Allow insert health snapshots"
ON public.health_snapshots
FOR INSERT
TO public
WITH CHECK (true);

-- Manter a policy de leitura apenas para admins
-- (já existe como "Admins podem visualizar health")