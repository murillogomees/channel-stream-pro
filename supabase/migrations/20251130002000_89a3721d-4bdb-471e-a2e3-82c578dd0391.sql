-- Create cron job for cf-stream-scheduler (runs every 5 minutes)
-- Sprint 2 Task B: Automated scheduler

SELECT cron.schedule(
  'cf-stream-scheduler-auto',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/cf-stream-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);