-- Tabela para configurações do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appkey TEXT NOT NULL,
  authkey TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS policies para whatsapp_config
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar config WhatsApp"
  ON public.whatsapp_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela para histórico de notificações (migrar de localStorage)
CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_vencimento_atual TIMESTAMPTZ NOT NULL,
  days_before_due INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  template_id TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notification_history_cliente ON public.notification_history(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON public.notification_history(sent_at);

-- RLS policies para notification_history
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar histórico"
  ON public.notification_history
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir histórico"
  ON public.notification_history
  FOR INSERT
  WITH CHECK (true);

-- Tabela para configuração de notificações automáticas
CREATE TABLE IF NOT EXISTS public.auto_notification_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  send_hour INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.auto_notification_config (enabled, send_hour)
VALUES (false, 10)
ON CONFLICT DO NOTHING;

-- RLS policies para auto_notification_config
ALTER TABLE public.auto_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar auto config"
  ON public.auto_notification_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_config_updated_at();

CREATE TRIGGER auto_notification_config_updated_at
  BEFORE UPDATE ON public.auto_notification_config
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_config_updated_at();