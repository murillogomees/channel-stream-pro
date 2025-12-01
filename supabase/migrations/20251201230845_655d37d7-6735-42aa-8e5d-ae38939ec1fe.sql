
-- Atualizar trigger de proteção
CREATE OR REPLACE FUNCTION protect_primary_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_email TEXT;
BEGIN
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.role != OLD.role)) THEN
    SELECT email INTO admin_email
    FROM auth.users
    WHERE id = OLD.user_id
    AND email IN ('murillo@gmail.com', 'rene@iptvlink.com.br');
    
    IF admin_email IS NOT NULL THEN
      IF TG_OP = 'UPDATE' AND NEW.role = 'master' THEN
        RETURN NEW;
      END IF;
      
      IF EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = OLD.user_id
        AND id != OLD.id
        AND role IN ('admin', 'super_admin', 'master')
      ) THEN
        RETURN OLD;
      END IF;
      
      RAISE EXCEPTION 'Não é permitido remover a role admin/master do administrador principal';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. Adicionar role master para murillo
INSERT INTO user_roles (user_id, role)
SELECT id, 'master'::app_role
FROM auth.users
WHERE email = 'murillo@gmail.com'
ON CONFLICT DO NOTHING;

-- 2. Deletar roles antigas do murillo (agora pode pois tem master)
DELETE FROM user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'murillo@gmail.com')
  AND role IN ('admin'::app_role, 'super_admin'::app_role);

-- 3. Converter super_admin para admin
UPDATE user_roles
SET role = 'admin'::app_role
WHERE role = 'super_admin'::app_role;

-- 4. Adicionar admins que faltam
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email IN ('rene@iptvlink.com.br', 'rene.correia@gmail.com', 'murilloggomes@gmail.com')
ON CONFLICT DO NOTHING;

-- 5. Adicionar clients que faltam
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'client'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;

-- UNIFICAR PROFILES E CLIENTES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS situacao situacao_cliente DEFAULT 'Testando';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plano plano_cliente DEFAULT 'Mensal';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_vencimento timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_contratacao timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cliente_ativo boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_ultimo_pagamento timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS forma_ultimo_pagamento text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mac_smart_one text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS usuario_m3u text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS senha_m3u text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_recorrente boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dispositivo_contratado dispositivo_tipo;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smartone_status smartone_status DEFAULT 'nao_enviado';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smartone_playlist_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smartone_raw_response text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smartone_last_sync_at timestamptz;

UPDATE profiles p SET 
  nome = COALESCE(p.nome, c.nome),
  telefone = COALESCE(p.telefone, c.telefone),
  email = COALESCE(p.email, c.email),
  situacao = c.situacao,
  plano = c.plano,
  data_vencimento = c.data_vencimento,
  valor_pago = c.valor_pago,
  cliente_ativo = c.cliente_ativo,
  mac_smart_one = c.mac_smart_one,
  is_recorrente = c.is_recorrente
FROM clientes c WHERE p.id = c.user_id;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Users view own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins all" ON profiles FOR ALL USING (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION update_profiles_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_profiles_updated_at_trigger ON profiles;
CREATE TRIGGER update_profiles_updated_at_trigger
  BEFORE UPDATE ON profiles FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

COMMENT ON TABLE profiles IS 'Tabela unificada de usuários';
COMMENT ON TABLE clientes IS 'DEPRECATED - usar profiles';
