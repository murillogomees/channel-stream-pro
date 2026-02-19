-- Schedule daily cleanup of MaxPlayer clients at 3 AM UTC
SELECT cron.schedule(
  'sigma-cleanup-maxplayer-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://waxgowafohlrfoefwhsf.supabase.co/functions/v1/sigma-cleanup-maxplayer',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);