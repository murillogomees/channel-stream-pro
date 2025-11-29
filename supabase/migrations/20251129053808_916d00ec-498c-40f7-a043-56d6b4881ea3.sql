-- Habilitar extensões necessárias se ainda não estiverem
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover cron job existente se houver
SELECT cron.unschedule('vod-auto-download')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'vod-auto-download'
);

-- Criar cron job para downloads automáticos de VOD a cada 30 minutos
SELECT cron.schedule(
  'vod-auto-download',
  '*/30 * * * *', -- A cada 30 minutos
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/schedule-vod-downloads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-supabase-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'limit', 30,
      'priority', 'size'
    )
  );
  $$
);