-- Remover cron job existente
SELECT cron.unschedule('vod-auto-download');

-- Criar cron job com Authorization header usando anon key
SELECT cron.schedule(
  'vod-auto-download',
  '*/30 * * * *', -- A cada 30 minutos
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/schedule-vod-downloads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body := '{"limit": 30, "priority": "size"}'::jsonb
  );
  $$
);