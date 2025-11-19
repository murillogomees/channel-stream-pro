-- ============================================
-- ATUALIZAÇÃO DE SEGURANÇA DOS CRON JOBS
-- ============================================
-- Este script atualiza todos os cron jobs para incluir autenticação via x-supabase-cron-secret
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/sql/new
--
-- ⚠️ IMPORTANTE: Certifique-se de que CRON_SECRET está configurado nos Edge Functions secrets
-- ============================================

-- 1. DAILY EXPIRATION SUMMARY (Executa diariamente às 10:00)
-- Remove o job antigo
SELECT cron.unschedule('daily-expiration-summary');

-- Cria o job com autenticação
SELECT cron.schedule(
  'daily-expiration-summary',
  '0 10 * * *', -- 10:00 AM todos os dias
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/daily-expiration-summary',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
        'x-supabase-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);

-- 2. WEEKLY EXPIRATION SUMMARY (Executa toda segunda-feira às 08:00)
-- Remove o job antigo
SELECT cron.unschedule('weekly-expiration-summary');

-- Cria o job com autenticação
SELECT cron.schedule(
  'weekly-expiration-summary',
  '0 8 * * 1', -- 08:00 AM toda segunda-feira
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/weekly-expiration-summary',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
        'x-supabase-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);

-- 3. ESCALATE SECURITY ALERTS (Executa a cada 5 minutos)
-- Remove o job antigo
SELECT cron.unschedule('escalate-security-alerts');

-- Cria o job com autenticação
SELECT cron.schedule(
  'escalate-security-alerts',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/escalate-security-alerts',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
        'x-supabase-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);

-- 4. ALERT INACTIVE PLAYLISTS (Executa diariamente às 09:00)
-- Remove o job antigo
SELECT cron.unschedule('alert-inactive-playlists');

-- Cria o job com autenticação
SELECT cron.schedule(
  'alert-inactive-playlists',
  '0 9 * * *', -- 09:00 AM todos os dias
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/alert-inactive-playlists',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
        'x-supabase-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);

-- 5. DAILY M3U REGENERATION (Executa diariamente às 03:00)
-- Remove o job antigo
SELECT cron.unschedule('daily-m3u-regeneration');

-- Cria o job com autenticação
SELECT cron.schedule(
  'daily-m3u-regeneration',
  '0 3 * * *', -- 03:00 AM todos os dias
  $$
  SELECT
    net.http_post(
      url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/daily-m3u-regeneration',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
        'x-supabase-cron-secret', current_setting('app.settings.cron_secret', true)
      ),
      body:=jsonb_build_object('time', now())
    ) as request_id;
  $$
);

-- ============================================
-- VERIFICAÇÃO DOS JOBS ATUALIZADOS
-- ============================================

-- Listar todos os cron jobs ativos
SELECT * FROM cron.job ORDER BY jobname;

-- Verificar histórico de execução recente
SELECT 
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. Antes de executar, configure o CRON_SECRET:
--    - Vá em: https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/settings/functions
--    - Adicione CRON_SECRET com um valor secreto forte
--
-- 2. Configure também no PostgreSQL (necessário para current_setting funcionar):
--    ALTER DATABASE postgres SET app.settings.cron_secret = 'seu-valor-secreto-aqui';
--
-- 3. Após executar, monitore os logs das Edge Functions:
--    https://supabase.com/dashboard/project/sdvyxdghxqmntyoweqbd/functions
--
-- 4. Verifique se os jobs estão sendo executados com sucesso:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- ============================================
