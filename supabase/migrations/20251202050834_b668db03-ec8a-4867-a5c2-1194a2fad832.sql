-- REMOVER COMPLETA INTEGRAÇÃO SMARTONE IPTV DO SISTEMA
-- Data: 2025-01-31
-- Autor: Sistema
-- Descrição: Remove todas as colunas, funções, triggers e referências ao SmartOne IPTV

-- 1. Remover colunas da tabela clientes (DEPRECATED)
ALTER TABLE public.clientes 
  DROP COLUMN IF EXISTS smartone_status CASCADE,
  DROP COLUMN IF EXISTS smartone_playlist_id CASCADE,
  DROP COLUMN IF EXISTS smartone_raw_response CASCADE,
  DROP COLUMN IF EXISTS smartone_last_sync_at CASCADE;

-- 2. Remover colunas da tabela profiles (tabela unificada atual)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS smartone_status CASCADE,
  DROP COLUMN IF EXISTS smartone_playlist_id CASCADE,
  DROP COLUMN IF EXISTS smartone_raw_response CASCADE,
  DROP COLUMN IF EXISTS smartone_last_sync_at CASCADE;

-- 3. Remover colunas da tabela health_snapshots
ALTER TABLE public.health_snapshots
  DROP COLUMN IF EXISTS smartone_status CASCADE,
  DROP COLUMN IF EXISTS smartone_latency CASCADE,
  DROP COLUMN IF EXISTS smartone_error CASCADE;

-- 4. Remover enum smartone_status (se existir)
DROP TYPE IF EXISTS smartone_status CASCADE;

-- 5. Remover índices relacionados (se existirem)
DROP INDEX IF EXISTS idx_clientes_smartone_status;
DROP INDEX IF EXISTS idx_profiles_smartone_status;
DROP INDEX IF EXISTS idx_clientes_smartone_playlist_id;
DROP INDEX IF EXISTS idx_profiles_smartone_playlist_id;

-- 6. Remover funções relacionadas (se existirem)
DROP FUNCTION IF EXISTS sync_smartone_playlist(uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_smartone_webhook(jsonb) CASCADE;
DROP FUNCTION IF EXISTS get_smartone_stats() CASCADE;

-- Comentário: Edge Functions smartone-sync, smartone-webhook e smartone-test
-- devem ser removidas manualmente através do Supabase Dashboard ou CLI