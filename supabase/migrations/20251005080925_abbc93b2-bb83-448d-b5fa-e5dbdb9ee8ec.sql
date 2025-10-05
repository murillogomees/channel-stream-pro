-- 1. Atualizar enum app_role para incluir 'app_user'
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'app_user';

-- 2. Criar tabela subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_devices INTEGER NOT NULL DEFAULT 1,
  m3u_list_id UUID REFERENCES m3u_lists(id) ON DELETE SET NULL,
  price NUMERIC(10,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies para subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (is_admin());

CREATE POLICY "Public can view active plans"
  ON subscription_plans FOR SELECT
  USING (active = true);

-- 3. Criar tabela activation_keys
CREATE TABLE IF NOT EXISTS activation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  generated_by UUID REFERENCES admins(id),
  used_by UUID,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT activation_key_format CHECK (key ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$')
);

CREATE INDEX IF NOT EXISTS idx_activation_keys_status ON activation_keys(status);
CREATE INDEX IF NOT EXISTS idx_activation_keys_key ON activation_keys(key);

-- RLS Policies para activation_keys
ALTER TABLE activation_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage activation keys"
  ON activation_keys FOR ALL
  USING (is_admin());

CREATE POLICY "Users can view their own used keys"
  ON activation_keys FOR SELECT
  USING (used_by IS NOT NULL AND status = 'used');

-- 4. Criar tabela app_users
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  activation_key_id UUID REFERENCES activation_keys(id),
  subscription_plan_id UUID REFERENCES subscription_plans(id),
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  device_info JSONB DEFAULT '{}'::jsonb,
  last_access_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_device_id ON app_users(device_id);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);
CREATE INDEX IF NOT EXISTS idx_app_users_expires_at ON app_users(expires_at);

-- RLS Policies para app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all app users"
  ON app_users FOR ALL
  USING (is_admin());

CREATE POLICY "Public can insert app users"
  ON app_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can view by device_id"
  ON app_users FOR SELECT
  USING (true);

CREATE POLICY "Public can update by device_id"
  ON app_users FOR UPDATE
  USING (true);

-- 5. Função validate_activation_key
CREATE OR REPLACE FUNCTION validate_activation_key(p_key TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  key_id UUID,
  plan_id UUID,
  plan_name TEXT,
  duration_days INTEGER,
  m3u_list_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_record RECORD;
  v_plan_record RECORD;
BEGIN
  SELECT ak.id, ak.status, ak.subscription_plan_id, ak.expires_at
  INTO v_key_record
  FROM activation_keys ak
  WHERE ak.key = p_key;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::INTEGER, NULL::UUID,
      'Chave de ativação inválida'::TEXT;
    RETURN;
  END IF;

  IF v_key_record.status = 'used' THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::INTEGER, NULL::UUID,
      'Chave já foi utilizada'::TEXT;
    RETURN;
  END IF;

  IF v_key_record.status = 'expired' OR (v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < NOW()) THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::INTEGER, NULL::UUID,
      'Chave de ativação expirada'::TEXT;
    RETURN;
  END IF;

  SELECT sp.id, sp.name, sp.duration_days, sp.m3u_list_id, sp.active
  INTO v_plan_record
  FROM subscription_plans sp
  WHERE sp.id = v_key_record.subscription_plan_id;

  IF NOT v_plan_record.active THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::INTEGER, NULL::UUID,
      'Plano de assinatura não está mais disponível'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    true,
    v_key_record.id,
    v_plan_record.id,
    v_plan_record.name,
    v_plan_record.duration_days,
    v_plan_record.m3u_list_id,
    NULL::TEXT;
END;
$$;

-- 6. Função activate_device
CREATE OR REPLACE FUNCTION activate_device(
  p_activation_key TEXT,
  p_device_id TEXT,
  p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success BOOLEAN,
  user_id UUID,
  expires_at TIMESTAMPTZ,
  m3u_url TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation RECORD;
  v_new_user_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_m3u_url TEXT;
BEGIN
  SELECT * INTO v_validation
  FROM validate_activation_key(p_activation_key)
  LIMIT 1;

  IF NOT v_validation.valid THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TEXT,
      v_validation.error_message;
    RETURN;
  END IF;

  v_expires_at := NOW() + (v_validation.duration_days || ' days')::INTERVAL;

  SELECT file_url INTO v_m3u_url
  FROM m3u_lists
  WHERE id = v_validation.m3u_list_id;

  INSERT INTO app_users (
    device_id,
    activation_key_id,
    subscription_plan_id,
    expires_at,
    device_info,
    status
  ) VALUES (
    p_device_id,
    v_validation.key_id,
    v_validation.plan_id,
    v_expires_at,
    p_device_info,
    'active'
  )
  RETURNING id INTO v_new_user_id;

  UPDATE activation_keys
  SET 
    status = 'used',
    used_by = v_new_user_id,
    used_at = NOW()
  WHERE id = v_validation.key_id;

  RETURN QUERY SELECT 
    true,
    v_new_user_id,
    v_expires_at,
    v_m3u_url,
    NULL::TEXT;
END;
$$;

-- 7. Função check_device_subscription
CREATE OR REPLACE FUNCTION check_device_subscription(p_device_id TEXT)
RETURNS TABLE (
  active BOOLEAN,
  user_id UUID,
  expires_at TIMESTAMPTZ,
  days_remaining INTEGER,
  m3u_url TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_m3u_url TEXT;
BEGIN
  SELECT 
    au.id,
    au.status,
    au.expires_at,
    au.subscription_plan_id
  INTO v_user
  FROM app_users au
  WHERE au.device_id = p_device_id
  ORDER BY au.activated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::INTEGER, NULL::TEXT, 'not_found'::TEXT;
    RETURN;
  END IF;

  IF v_user.expires_at < NOW() AND v_user.status = 'active' THEN
    UPDATE app_users
    SET status = 'expired'
    WHERE id = v_user.id;
    
    v_user.status := 'expired';
  END IF;

  SELECT ml.file_url INTO v_m3u_url
  FROM m3u_lists ml
  JOIN subscription_plans sp ON sp.m3u_list_id = ml.id
  WHERE sp.id = v_user.subscription_plan_id;

  UPDATE app_users
  SET last_access_at = NOW()
  WHERE id = v_user.id;

  RETURN QUERY SELECT 
    (v_user.status = 'active' AND v_user.expires_at > NOW()),
    v_user.id,
    v_user.expires_at,
    GREATEST(0, EXTRACT(DAY FROM v_user.expires_at - NOW())::INTEGER),
    v_m3u_url,
    v_user.status;
END;
$$;

-- 8. Função generate_activation_keys (para admins)
CREATE OR REPLACE FUNCTION generate_activation_keys(
  p_subscription_plan_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  key TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  i INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar chaves de ativação';
  END IF;

  FOR i IN 1..p_quantity LOOP
    v_key := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4)
    );

    INSERT INTO activation_keys (
      key,
      subscription_plan_id,
      generated_by,
      expires_at
    ) VALUES (
      v_key,
      p_subscription_plan_id,
      auth.uid(),
      p_expires_at
    );

    RETURN QUERY SELECT v_key, NOW();
  END LOOP;
END;
$$;

-- 9. Trigger para updated_at em subscription_plans
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Trigger para updated_at em app_users
CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();