-- =====================================================
-- TABELAS ADICIONAIS - Sistema de Ativação e Planos
-- =====================================================

-- 1. TABELA DE PLANOS DE ASSINATURA
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    max_devices INTEGER DEFAULT 1,
    price NUMERIC(10,2) NOT NULL,
    active BOOLEAN DEFAULT true,
    m3u_list_id UUID REFERENCES public.m3u_lists(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar planos"
ON public.subscription_plans FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem visualizar planos ativos"
ON public.subscription_plans FOR SELECT
USING (active = true);

-- 2. TABELA DE CHAVES DE ATIVAÇÃO
CREATE TABLE public.activation_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    subscription_plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_activation_keys_key ON public.activation_keys(key);
CREATE INDEX idx_activation_keys_status ON public.activation_keys(status);

CREATE POLICY "Admins podem gerenciar chaves"
ON public.activation_keys FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 3. TABELA DE USUÁRIOS DO APP
CREATE TABLE public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    mac_address TEXT,
    subscription_plan_id UUID REFERENCES public.subscription_plans(id),
    activation_key_id UUID REFERENCES public.activation_keys(id),
    status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'suspended')),
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_app_users_device ON public.app_users(device_id);
CREATE INDEX idx_app_users_mac ON public.app_users(mac_address);
CREATE INDEX idx_app_users_status ON public.app_users(status);

CREATE POLICY "Admins podem gerenciar app users"
ON public.app_users FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 4. FUNÇÃO PARA GERAR CHAVES DE ATIVAÇÃO
CREATE OR REPLACE FUNCTION public.generate_activation_keys(
    plan_id UUID,
    quantity INTEGER
)
RETURNS TABLE (
    key TEXT,
    id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    i INTEGER;
    new_key TEXT;
    new_id UUID;
BEGIN
    FOR i IN 1..quantity LOOP
        new_key := upper(substring(md5(random()::text) from 1 for 8) || '-' || 
                        substring(md5(random()::text) from 1 for 8) || '-' || 
                        substring(md5(random()::text) from 1 for 8));
        
        INSERT INTO public.activation_keys (key, subscription_plan_id)
        VALUES (new_key, plan_id)
        RETURNING activation_keys.id, activation_keys.key INTO new_id, new_key;
        
        RETURN QUERY SELECT new_key, new_id;
    END LOOP;
END;
$$;

-- 5. FUNÇÃO PARA VALIDAR CHAVE DE ATIVAÇÃO
CREATE OR REPLACE FUNCTION public.validate_activation_key(
    activation_key TEXT
)
RETURNS TABLE (
    valid BOOLEAN,
    plan_id UUID,
    plan_name TEXT,
    duration_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
BEGIN
    SELECT 
        ak.id,
        ak.status,
        ak.expires_at,
        sp.id as plan_id,
        sp.name as plan_name,
        sp.duration_days
    INTO key_record
    FROM public.activation_keys ak
    JOIN public.subscription_plans sp ON ak.subscription_plan_id = sp.id
    WHERE ak.key = activation_key;
    
    IF key_record IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::INTEGER;
        RETURN;
    END IF;
    
    IF key_record.status != 'available' THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::INTEGER;
        RETURN;
    END IF;
    
    IF key_record.expires_at IS NOT NULL AND key_record.expires_at < now() THEN
        UPDATE public.activation_keys SET status = 'expired' WHERE key = activation_key;
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::INTEGER;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT 
        true,
        key_record.plan_id,
        key_record.plan_name,
        key_record.duration_days;
END;
$$;

-- 6. FUNÇÃO PARA ATIVAR DISPOSITIVO
CREATE OR REPLACE FUNCTION public.activate_device(
    device_id TEXT,
    activation_key TEXT,
    mac_addr TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
    plan_record RECORD;
    expiration_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Verificar se a chave é válida
    SELECT * INTO key_record
    FROM public.activation_keys
    WHERE key = activation_key AND status = 'available';
    
    IF key_record IS NULL THEN
        RETURN QUERY SELECT false, 'Chave de ativação inválida ou já utilizada'::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Buscar informações do plano
    SELECT * INTO plan_record
    FROM public.subscription_plans
    WHERE id = key_record.subscription_plan_id;
    
    -- Calcular data de expiração
    expiration_date := now() + (plan_record.duration_days || ' days')::INTERVAL;
    
    -- Marcar chave como usada
    UPDATE public.activation_keys
    SET status = 'used', used_at = now()
    WHERE key = activation_key;
    
    -- Criar ou atualizar usuário do app
    INSERT INTO public.app_users (
        device_id,
        mac_address,
        subscription_plan_id,
        activation_key_id,
        status,
        activated_at,
        expires_at
    )
    VALUES (
        device_id,
        mac_addr,
        plan_record.id,
        key_record.id,
        'active',
        now(),
        expiration_date
    )
    ON CONFLICT (device_id) DO UPDATE
    SET 
        subscription_plan_id = plan_record.id,
        activation_key_id = key_record.id,
        status = 'active',
        activated_at = now(),
        expires_at = expiration_date,
        updated_at = now();
    
    RETURN QUERY SELECT true, 'Dispositivo ativado com sucesso'::TEXT, expiration_date;
END;
$$;

-- 7. FUNÇÃO PARA VERIFICAR ASSINATURA DO DISPOSITIVO
CREATE OR REPLACE FUNCTION public.check_device_subscription(
    device_id TEXT
)
RETURNS TABLE (
    is_active BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER,
    plan_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT 
        au.status,
        au.expires_at,
        sp.name as plan_name
    INTO user_record
    FROM public.app_users au
    LEFT JOIN public.subscription_plans sp ON au.subscription_plan_id = sp.id
    WHERE au.device_id = device_id;
    
    IF user_record IS NULL THEN
        RETURN QUERY SELECT false, NULL::TIMESTAMP WITH TIME ZONE, 0, NULL::TEXT;
        RETURN;
    END IF;
    
    IF user_record.status = 'active' AND user_record.expires_at > now() THEN
        RETURN QUERY SELECT 
            true,
            user_record.expires_at,
            EXTRACT(DAY FROM (user_record.expires_at - now()))::INTEGER,
            user_record.plan_name;
    ELSE
        -- Atualizar status se expirado
        IF user_record.expires_at < now() THEN
            UPDATE public.app_users SET status = 'expired' WHERE app_users.device_id = device_id;
        END IF;
        
        RETURN QUERY SELECT false, user_record.expires_at, 0, user_record.plan_name;
    END IF;
END;
$$;

-- 8. TRIGGER PARA ATUALIZAR updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. COMENTÁRIOS
COMMENT ON TABLE public.subscription_plans IS 'Planos de assinatura disponíveis';
COMMENT ON TABLE public.activation_keys IS 'Chaves de ativação para dispositivos';
COMMENT ON TABLE public.app_users IS 'Usuários do aplicativo IPTV';
COMMENT ON FUNCTION public.generate_activation_keys IS 'Gera chaves de ativação em lote';
COMMENT ON FUNCTION public.validate_activation_key IS 'Valida uma chave de ativação';
COMMENT ON FUNCTION public.activate_device IS 'Ativa um dispositivo com uma chave';
COMMENT ON FUNCTION public.check_device_subscription IS 'Verifica status da assinatura de um dispositivo';