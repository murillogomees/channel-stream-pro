-- Tabela de entregas de alertas (tracking)
CREATE TABLE IF NOT EXISTS public.security_alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_event_id UUID NOT NULL,
  admin_phone_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (admin_phone_id) REFERENCES public.admin_phones(id) ON DELETE CASCADE
);

-- Tabela de regras de escalonamento
CREATE TABLE IF NOT EXISTS public.security_alert_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity_level TEXT NOT NULL,
  time_window_minutes INTEGER NOT NULL DEFAULT 10,
  escalation_action TEXT NOT NULL DEFAULT 'notify_all',
  secondary_admin_ids UUID[],
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.security_alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alert_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver entregas de alertas"
  ON public.security_alert_deliveries
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir entregas"
  ON public.security_alert_deliveries
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar entregas"
  ON public.security_alert_deliveries
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins podem gerenciar regras de escalonamento"
  ON public.security_alert_escalation_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Índices para performance
CREATE INDEX idx_alert_deliveries_event ON public.security_alert_deliveries(security_event_id);
CREATE INDEX idx_alert_deliveries_admin ON public.security_alert_deliveries(admin_phone_id);
CREATE INDEX idx_alert_deliveries_confirmed ON public.security_alert_deliveries(confirmed_at);
CREATE INDEX idx_alert_deliveries_sent_at ON public.security_alert_deliveries(sent_at);
CREATE INDEX idx_escalation_rules_event_type ON public.security_alert_escalation_rules(event_type);
CREATE INDEX idx_escalation_rules_enabled ON public.security_alert_escalation_rules(enabled);

-- Trigger para updated_at
CREATE TRIGGER update_escalation_rules_updated_at
  BEFORE UPDATE ON public.security_alert_escalation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Regras de escalonamento padrão
INSERT INTO public.security_alert_escalation_rules (
  rule_name,
  event_type,
  severity_level,
  time_window_minutes,
  escalation_action,
  enabled
) VALUES
(
  'Escalonamento Login Crítico',
  'failed_login',
  'critical',
  10,
  'notify_all',
  true
),
(
  'Escalonamento Atividade Suspeita',
  'suspicious_activity',
  'critical',
  5,
  'notify_all',
  true
),
(
  'Escalonamento Acesso Não Autorizado',
  'unauthorized_access',
  'critical',
  5,
  'notify_all',
  true
);