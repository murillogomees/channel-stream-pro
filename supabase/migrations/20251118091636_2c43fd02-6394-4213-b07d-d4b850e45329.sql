-- Create notification_retry_queue table
CREATE TABLE IF NOT EXISTS public.notification_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('client_notification', 'admin_alert', 'system_notification', 'welcome', 'renewal', 'expiration')),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_content TEXT NOT NULL,
  template_name TEXT,
  client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL,
  error_message TEXT,
  error_details JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'succeeded', 'exhausted')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_status ON public.notification_retry_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_next_retry ON public.notification_retry_queue(next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_client_id ON public.notification_retry_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_type ON public.notification_retry_queue(type);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_retry_queue_updated_at
  BEFORE UPDATE ON public.notification_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retry_queue_updated_at();

-- Enable RLS
ALTER TABLE public.notification_retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins podem visualizar retry queue"
  ON public.notification_retry_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir retry queue"
  ON public.notification_retry_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar retry queue"
  ON public.notification_retry_queue FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem deletar retry queue"
  ON public.notification_retry_queue FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_retry_queue;

-- Create function to get retry queue stats
CREATE OR REPLACE FUNCTION public.get_notification_retry_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'retrying', COUNT(*) FILTER (WHERE status = 'retrying'),
    'succeeded', COUNT(*) FILTER (WHERE status = 'succeeded'),
    'exhausted', COUNT(*) FILTER (WHERE status = 'exhausted'),
    'avg_attempts', AVG(attempts),
    'oldest_pending', MIN(created_at) FILTER (WHERE status IN ('pending', 'retrying'))
  )
  INTO result
  FROM public.notification_retry_queue;
  
  RETURN result;
END;
$$;