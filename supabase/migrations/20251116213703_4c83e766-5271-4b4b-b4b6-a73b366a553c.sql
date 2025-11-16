-- A policy já existe mas precisa permitir INSERT sem autenticação
-- pois o serviço de métricas precisa salvar dados

-- Remover policy restritiva existente se houver
DROP POLICY IF EXISTS "Service can insert metrics snapshots" ON public.metrics_snapshots;

-- Recriar policy permitindo INSERT para todos (anon role também)
CREATE POLICY "Allow insert metrics snapshots"
ON public.metrics_snapshots
FOR INSERT
WITH CHECK (true);