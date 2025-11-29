-- =====================================================
-- LIMPEZA: Remover tabelas e funções não utilizadas
-- =====================================================

-- 1. Remover tabela activation_keys
DROP TABLE IF EXISTS public.activation_keys CASCADE;

-- 2. Remover tabela admin_leaderboard_history e função relacionada
DROP FUNCTION IF EXISTS public.save_monthly_leaderboard() CASCADE;
DROP TABLE IF EXISTS public.admin_leaderboard_history CASCADE;

-- 3. Remover tabela smartone_sync_retry_queue
DROP TABLE IF EXISTS public.smartone_sync_retry_queue CASCADE;

-- 4. Remover tabela permission_discrepancy_alerts e função relacionada
DROP FUNCTION IF EXISTS public.detect_permission_discrepancies(uuid, uuid, text, text[], text[], boolean, boolean) CASCADE;
DROP TABLE IF EXISTS public.permission_discrepancy_alerts CASCADE;

-- Comentário de auditoria
COMMENT ON SCHEMA public IS 'Limpeza de 4 tabelas órfãs realizada em 29/11/2025';