-- ============================================
-- LIMPEZA DE TABELAS NÃO UTILIZADAS
-- ============================================

-- Tabelas com 0 registros e sem uso ativo
DROP TABLE IF EXISTS public.supabase_instances CASCADE;
DROP TABLE IF EXISTS public.passkey_credentials CASCADE;
DROP TABLE IF EXISTS public.trending_rankings CASCADE;
DROP TABLE IF EXISTS public.rls_audit_resolutions CASCADE;
DROP TABLE IF EXISTS public.sent_notifications CASCADE;
DROP TABLE IF EXISTS public.player_events CASCADE;
DROP TABLE IF EXISTS public.system_backups CASCADE;

-- Partições vazias de performance_metrics (se existirem)
DROP TABLE IF EXISTS public.performance_metrics_2025_01 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_02 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_03 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_04 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_05 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_06 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_07 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_08 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_09 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_10 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_11 CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_2025_12 CASCADE;