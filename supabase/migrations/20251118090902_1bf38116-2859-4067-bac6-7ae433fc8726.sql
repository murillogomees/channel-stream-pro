-- Create m3u_health_checks table for monitoring M3U list health
CREATE TABLE IF NOT EXISTS public.m3u_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  m3u_list_id UUID NOT NULL REFERENCES public.m3u_lists(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('healthy', 'error', 'warning', 'pending')),
  response_time_ms INTEGER,
  http_status_code INTEGER,
  error_message TEXT,
  channel_count INTEGER,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_m3u_health_checks_list_id ON public.m3u_health_checks(m3u_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_health_checks_status ON public.m3u_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_m3u_health_checks_last_checked ON public.m3u_health_checks(last_checked_at DESC);

-- Add health_snoozed_until column to m3u_lists
ALTER TABLE public.m3u_lists 
ADD COLUMN IF NOT EXISTS health_snoozed_until TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.m3u_health_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins podem visualizar health checks"
  ON public.m3u_health_checks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir health checks"
  ON public.m3u_health_checks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.m3u_health_checks;