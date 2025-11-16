-- Create table for rate limiting tracking
CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- IP address or user_id
  endpoint TEXT NOT NULL,     -- Function name
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_tracking_unique UNIQUE (identifier, endpoint, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin can view rate limits"
  ON public.rate_limit_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow Edge Functions to insert/update (they use service role)
-- No additional policies needed for service role

-- Index for fast lookups
CREATE INDEX idx_rate_limit_identifier_endpoint 
  ON public.rate_limit_tracking(identifier, endpoint, window_start DESC);

-- Function to clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_tracking
  WHERE window_start < now() - interval '1 hour';
END;
$$;

-- Create a cron job would be ideal, but for now we'll clean up opportunistically in the rate limit check