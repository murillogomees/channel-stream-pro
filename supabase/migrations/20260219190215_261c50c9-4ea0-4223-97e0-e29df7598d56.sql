-- Add username and password fields to sigma_blaze_config for session-based auth
ALTER TABLE public.sigma_blaze_config 
  ADD COLUMN IF NOT EXISTS sigma_username TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sigma_password TEXT NOT NULL DEFAULT '';

-- Add token cache table for persisting auth sessions across cold starts
CREATE TABLE IF NOT EXISTS public.sigma_auth_cache (
  id TEXT PRIMARY KEY DEFAULT 'default',
  access_token TEXT NOT NULL,
  session_cookie TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sigma_auth_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access this
CREATE POLICY "Service role only" ON public.sigma_auth_cache
  FOR ALL USING (false);
