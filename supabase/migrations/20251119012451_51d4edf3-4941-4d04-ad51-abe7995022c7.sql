-- Remover trigger que tenta atualizar campo updated_at inexistente na tabela clientes
DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;

-- Se existir a função de trigger genérica, remover referência
DROP FUNCTION IF EXISTS public.update_clientes_updated_at() CASCADE;