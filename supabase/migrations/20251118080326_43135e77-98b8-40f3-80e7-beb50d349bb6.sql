-- Tabela para status personalizados do sistema
CREATE TABLE IF NOT EXISTS custom_status_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) NOT NULL, -- hex color like #FF5733
  icon_name VARCHAR(50), -- lucide icon name
  is_critical BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para histórico de mudanças de status
CREATE TABLE IF NOT EXISTS status_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(100) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_status_history_service ON status_change_history(service_name);
CREATE INDEX IF NOT EXISTS idx_status_history_date ON status_change_history(changed_at DESC);

-- RLS Policies para custom_status_badges
ALTER TABLE custom_status_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar status personalizados"
  ON custom_status_badges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins podem criar status personalizados"
  ON custom_status_badges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins podem atualizar status personalizados"
  ON custom_status_badges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins podem deletar status personalizados"
  ON custom_status_badges FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- RLS Policies para status_change_history
ALTER TABLE status_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar histórico de status"
  ON status_change_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins podem criar registros de histórico"
  ON status_change_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_custom_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custom_status_updated_at
  BEFORE UPDATE ON custom_status_badges
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_status_updated_at();

-- Função para registrar mudanças de status automaticamente
CREATE OR REPLACE FUNCTION log_status_change(
  p_service_name VARCHAR,
  p_previous_status VARCHAR,
  p_new_status VARCHAR,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
BEGIN
  INSERT INTO status_change_history (
    service_name,
    previous_status,
    new_status,
    metadata,
    created_by
  ) VALUES (
    p_service_name,
    p_previous_status,
    p_new_status,
    p_metadata,
    auth.uid()
  ) RETURNING id INTO v_history_id;
  
  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;