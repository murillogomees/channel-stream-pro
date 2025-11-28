-- ============================================
-- M3U Sync CRON Setup
-- Execute este SQL no Supabase SQL Editor
-- https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/sql/new
-- ============================================

-- 1. Habilitar extensões necessárias (se ainda não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar CRON job para sincronização automática a cada 30 minutos
SELECT cron.schedule(
  'm3u-sync-cron-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-cron-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '", "source": "cron"}')::jsonb
  ) AS request_id;
  $$
);

-- 3. Criar CRON job para limpeza de dados antigos (diário às 3h)
SELECT cron.schedule(
  'm3u-sync-cleanup-daily',
  '0 3 * * *',
  $$
  SELECT cleanup_old_m3u_sync_data();
  $$
);

-- ============================================
-- Comandos úteis para gerenciamento
-- ============================================

-- Listar todos os CRON jobs
-- SELECT * FROM cron.job ORDER BY jobid DESC;

-- Ver histórico de execuções
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Pausar job específico
-- UPDATE cron.job SET active = false WHERE jobname = 'm3u-sync-cron-30min';

-- Reativar job
-- UPDATE cron.job SET active = true WHERE jobname = 'm3u-sync-cron-30min';

-- Remover job
-- SELECT cron.unschedule('m3u-sync-cron-30min');

-- Executar sync manualmente
-- SELECT net.http_post(
--   url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/m3u-cron-sync',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
--   body := '{"triggered_at": "manual", "source": "manual"}'::jsonb
-- ) AS request_id;
