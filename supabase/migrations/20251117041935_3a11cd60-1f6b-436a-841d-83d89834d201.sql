-- Tabela para configurar notificações automáticas do sistema
CREATE TABLE IF NOT EXISTS public.automatic_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'client_registration', 'payment_due', 'payment_received', 'client_update', 'trial_ending'
  trigger_condition TEXT NOT NULL, -- 'on_registration', 'days_before_due', 'on_payment', 'on_update', etc
  days_before INTEGER, -- Para notificações baseadas em dias antes do vencimento
  target_audience TEXT NOT NULL DEFAULT 'client', -- 'client', 'admin', 'both'
  template_reference TEXT, -- Referência ao template de mensagem
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Ordem de prioridade de execução
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX idx_automatic_notification_rules_event_type ON public.automatic_notification_rules(event_type);
CREATE INDEX idx_automatic_notification_rules_active ON public.automatic_notification_rules(active);
CREATE INDEX idx_automatic_notification_rules_priority ON public.automatic_notification_rules(priority DESC);

-- RLS Policies
ALTER TABLE public.automatic_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar regras de notificação"
  ON public.automatic_notification_rules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_automatic_notification_rules_updated_at
  BEFORE UPDATE ON public.automatic_notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir algumas regras padrão
INSERT INTO public.automatic_notification_rules (name, description, event_type, trigger_condition, days_before, target_audience, template_reference, active, priority) VALUES
('Boas-vindas - Novo Cliente Teste', 'Mensagem enviada ao cliente quando se cadastra em período de teste', 'client_registration', 'on_registration', NULL, 'client', 'welcome_trial', true, 10),
('Boas-vindas - Novo Cliente Plano', 'Mensagem enviada ao cliente quando contrata um plano', 'client_registration', 'on_registration', NULL, 'client', 'welcome_plan', true, 10),
('Notificação Admin - Novo Cliente', 'Notifica administradores sobre novo cadastro', 'client_registration', 'on_registration', NULL, 'admin', 'admin_new_client', true, 5),
('Lembrete 7 dias antes vencimento', 'Lembrete enviado 7 dias antes do vencimento', 'payment_due', 'days_before_due', 7, 'client', 'expiration_7_days', true, 7),
('Lembrete 3 dias antes vencimento', 'Lembrete enviado 3 dias antes do vencimento', 'payment_due', 'days_before_due', 3, 'client', 'expiration_3_days', true, 8),
('Lembrete no dia do vencimento', 'Lembrete enviado no dia do vencimento', 'payment_due', 'days_before_due', 0, 'client', 'expiration_today', true, 9),
('Confirmação de Pagamento', 'Mensagem enviada quando pagamento é detectado', 'payment_received', 'on_payment', NULL, 'client', 'renewal', true, 10),
('Notificação Admin - Pagamento Recebido', 'Notifica administradores sobre pagamento recebido', 'payment_received', 'on_payment', NULL, 'admin', 'admin_payment_received', true, 5);