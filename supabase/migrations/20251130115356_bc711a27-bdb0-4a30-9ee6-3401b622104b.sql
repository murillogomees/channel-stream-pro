-- Create table for Mercado Pago API configuration
CREATE TABLE public.mercado_pago_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sandbox_access_token TEXT,
  production_access_token TEXT,
  public_key TEXT,
  webhook_secret TEXT,
  use_sandbox BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.mercado_pago_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write config
CREATE POLICY "Admins can manage mercado pago config"
ON public.mercado_pago_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Create update trigger
CREATE TRIGGER update_mercado_pago_config_updated_at
  BEFORE UPDATE ON public.mercado_pago_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_m3u_updated_at();

-- Insert default row (will be updated, not inserted multiple times)
INSERT INTO public.mercado_pago_config (id, use_sandbox)
VALUES ('00000000-0000-0000-0000-000000000001', true);