-- Criar tabela de agendamento de notificações
CREATE TABLE IF NOT EXISTS notification_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'expiration', 'welcome', 'renewal', etc
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  days_before_due INTEGER, -- Para notificações de vencimento
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_notification_schedule_status ON notification_schedule(status);
CREATE INDEX idx_notification_schedule_scheduled_for ON notification_schedule(scheduled_for);
CREATE INDEX idx_notification_schedule_cliente ON notification_schedule(cliente_id);
CREATE INDEX idx_notification_schedule_type ON notification_schedule(notification_type);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_notification_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_schedule_updated_at
  BEFORE UPDATE ON notification_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_schedule_updated_at();

-- RLS Policies para notification_schedule
ALTER TABLE notification_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification schedule"
  ON notification_schedule FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON p.id = ur.user_id
      WHERE p.id = auth.uid()
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage notification schedule"
  ON notification_schedule FOR ALL
  TO service_role
  USING (true);