
-- Add proxy configuration columns to sigma_blaze_config
ALTER TABLE public.sigma_blaze_config
  ADD COLUMN IF NOT EXISTS proxy_host text DEFAULT '',
  ADD COLUMN IF NOT EXISTS proxy_port integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proxy_user text DEFAULT '',
  ADD COLUMN IF NOT EXISTS proxy_pass text DEFAULT '';
