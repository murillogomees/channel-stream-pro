-- SQL para configurar backup automático diário via Supabase Cron
-- Execute este SQL manualmente no SQL Editor do Supabase Dashboard

-- Ativar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Agendar backup automático diário às 03:00 AM
SELECT cron.schedule(
  'daily-client-backup',
  '0 3 * * *', -- Às 03:00 AM todos os dias
  $$
  SELECT
    net.http_post(
        url:='https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/backup-clients',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Verificar se o agendamento foi criado
SELECT * FROM cron.job WHERE jobname = 'daily-client-backup';

-- Para desativar o backup automático (se necessário):
-- SELECT cron.unschedule('daily-client-backup');

-- Para ver todos os agendamentos ativos:
-- SELECT * FROM cron.job;

-- Para ver o histórico de execuções:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-client-backup') ORDER BY start_time DESC LIMIT 10;
