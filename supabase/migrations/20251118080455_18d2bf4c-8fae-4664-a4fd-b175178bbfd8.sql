-- Dropar trigger primeiro, depois função, e recriar com search_path seguro
DROP TRIGGER IF EXISTS trigger_update_custom_status_updated_at ON custom_status_badges;
DROP FUNCTION IF EXISTS update_custom_status_updated_at();
DROP FUNCTION IF EXISTS log_status_change(VARCHAR, VARCHAR, VARCHAR, JSONB);

-- Recriar função com search_path seguro
CREATE OR REPLACE FUNCTION update_custom_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
CREATE TRIGGER trigger_update_custom_status_updated_at
  BEFORE UPDATE ON custom_status_badges
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_status_updated_at();

-- Recriar função de log com search_path seguro
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;