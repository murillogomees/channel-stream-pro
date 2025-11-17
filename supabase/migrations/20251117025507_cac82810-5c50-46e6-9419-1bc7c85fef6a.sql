-- Corrigir política RLS da tabela m3u_lists para permitir INSERT por admins
DROP POLICY IF EXISTS "Admins podem gerenciar listas M3U" ON public.m3u_lists;

CREATE POLICY "Admins podem gerenciar listas M3U"
ON public.m3u_lists
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Adicionar comentário
COMMENT ON POLICY "Admins podem gerenciar listas M3U" ON public.m3u_lists 
IS 'Permite que administradores façam todas as operações (SELECT, INSERT, UPDATE, DELETE) em listas M3U';