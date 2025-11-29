-- =====================================================
-- LIMPEZA: Remover trigger e função órfã sync_client_on_mac_update
-- (Referencia edge function sync-new-client que não existe)
-- =====================================================

-- Remover trigger
DROP TRIGGER IF EXISTS trigger_sync_client_on_mac_update ON public.clientes;

-- Remover função
DROP FUNCTION IF EXISTS public.sync_client_on_mac_update() CASCADE;