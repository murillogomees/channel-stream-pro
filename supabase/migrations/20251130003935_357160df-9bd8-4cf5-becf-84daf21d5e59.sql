-- Remove the old cron job that was failing with 401
SELECT cron.unschedule('cf-stream-scheduler-auto');

-- Create a config table for storing the cron secret (if not exists)
CREATE TABLE IF NOT EXISTS public.scheduler_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on config table (admin only)
ALTER TABLE public.scheduler_config ENABLE ROW LEVEL SECURITY;

-- Only admins can access config
CREATE POLICY "Admins can manage scheduler config" ON public.scheduler_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructions for user: The cron job needs the CRON_SECRET to authenticate.
-- Since we can't store secrets in migrations, please run this SQL manually in the SQL Editor
-- after replacing YOUR_CRON_SECRET with your actual CRON_SECRET value:
--
-- INSERT INTO public.scheduler_config (key, value) VALUES ('cron_secret', 'YOUR_CRON_SECRET_HERE')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- Then create the cron job with:
-- SELECT cron.schedule(
--   'cf-stream-scheduler-auto',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/cf-stream-scheduler',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-supabase-cron-secret', (SELECT value FROM public.scheduler_config WHERE key = 'cron_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );