-- Criar tabela para log de webhooks do Mercado Pago
CREATE TABLE IF NOT EXISTS public.mercado_pago_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT,
  event_type TEXT,
  action TEXT,
  data_id TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mercado_pago_webhooks ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar webhooks
CREATE POLICY "Admins can manage mercado pago webhooks" 
ON public.mercado_pago_webhooks 
FOR ALL
USING (is_admin_or_master());

-- Allow system to insert webhooks (from edge function)
CREATE POLICY "System can insert webhooks" 
ON public.mercado_pago_webhooks 
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mp_webhooks_event_id ON public.mercado_pago_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_mp_webhooks_processed ON public.mercado_pago_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_mp_webhooks_created_at ON public.mercado_pago_webhooks(created_at DESC);