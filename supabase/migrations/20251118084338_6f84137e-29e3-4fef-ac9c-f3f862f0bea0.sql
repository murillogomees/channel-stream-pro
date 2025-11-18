-- Create retry queue table for SmartOne sync failures
CREATE TABLE IF NOT EXISTS public.smartone_sync_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'exhausted', 'succeeded'))
);

-- Enable RLS
ALTER TABLE public.smartone_sync_retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retry queue (admin only)
CREATE POLICY "Admins can view retry queue"
  ON public.smartone_sync_retry_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert retry queue"
  ON public.smartone_sync_retry_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update retry queue"
  ON public.smartone_sync_retry_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_retry_queue_status_next_retry 
  ON public.smartone_sync_retry_queue(status, next_retry_at)
  WHERE status IN ('pending', 'retrying');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_retry_queue_timestamp
  BEFORE UPDATE ON public.smartone_sync_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_retry_queue_updated_at();

-- Enable realtime for tables
ALTER TABLE public.playlist_health_checks REPLICA IDENTITY FULL;
ALTER TABLE public.smartone_sync_retry_queue REPLICA IDENTITY FULL;

-- Add tables to realtime publication (only if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'playlist_health_checks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_health_checks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'smartone_sync_retry_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.smartone_sync_retry_queue;
  END IF;
END $$;