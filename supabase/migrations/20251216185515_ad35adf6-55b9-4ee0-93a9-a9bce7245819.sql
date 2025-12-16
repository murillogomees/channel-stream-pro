-- Update all cron jobs to use the correct Supabase project URL (sdvyxdghxqmntyoweqbd)

-- Job 1: process-auto-notifications-daily
SELECT cron.unschedule('process-auto-notifications-daily');
SELECT cron.schedule(
  'process-auto-notifications-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/process-auto-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Job 2: daily-backup
SELECT cron.unschedule('daily-backup');
SELECT cron.schedule(
  'daily-backup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/scheduled-backup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Job 3: weekly-cleanup
SELECT cron.unschedule('weekly-cleanup');
SELECT cron.schedule(
  'weekly-cleanup',
  '0 4 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/cleanup-old-logs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);