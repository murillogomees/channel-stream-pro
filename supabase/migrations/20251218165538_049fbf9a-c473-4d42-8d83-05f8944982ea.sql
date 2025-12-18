-- Update all cron jobs to use the correct Lovable Cloud project URL (waxgowafohlrfoefwhsf)

-- Drop old jobs and recreate with correct URL
SELECT cron.unschedule('origin-health-check-30s');
SELECT cron.unschedule('process-auto-notifications-daily');
SELECT cron.unschedule('daily-backup');
SELECT cron.unschedule('weekly-cleanup');

-- Recreate: Origin health check every 30 seconds
SELECT cron.schedule(
  'origin-health-check-30s',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := 'https://waxgowafohlrfoefwhsf.supabase.co/functions/v1/origin-health-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Recreate: Process auto notifications daily at 10 AM
SELECT cron.schedule(
  'process-auto-notifications-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://waxgowafohlrfoefwhsf.supabase.co/functions/v1/process-auto-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);

-- Recreate: Daily backup at 3 AM
SELECT cron.schedule(
  'daily-backup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://waxgowafohlrfoefwhsf.supabase.co/functions/v1/scheduled-backup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Recreate: Weekly cleanup at 4 AM on Sundays
SELECT cron.schedule(
  'weekly-cleanup',
  '0 4 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://waxgowafohlrfoefwhsf.supabase.co/functions/v1/cleanup-old-logs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheGdvd2Fmb2hscmZvZWZ3aHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);