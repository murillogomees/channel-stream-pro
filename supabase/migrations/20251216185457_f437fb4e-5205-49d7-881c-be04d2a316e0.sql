-- Fix the broken cron job that's causing errors
-- Remove the old job and recreate with correct URL

SELECT cron.unschedule('origin-health-check-30s');

-- Recreate with hardcoded URL (same pattern as other jobs)
SELECT cron.schedule(
  'origin-health-check-30s',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/origin-health-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzAzMDMsImV4cCI6MjA4MDg0NjMwM30.dgqou7A6mcKc5hmn7aV15FDhkEf0uA3hiYp8v_T2MBw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);