-- Criar tabela de IPs confiáveis (whitelist)
CREATE TABLE IF NOT EXISTS public.ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  description text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ip_whitelist
CREATE POLICY "Admins podem gerenciar whitelist"
  ON public.ip_whitelist
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Atualizar função check_suspicious_login para verificar whitelist primeiro
CREATE OR REPLACE FUNCTION public.check_suspicious_login(
  _ip_address text,
  _email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_count integer;
  v_should_block boolean := false;
  v_should_alert boolean := false;
  v_is_whitelisted boolean := false;
  v_existing_record record;
BEGIN
  -- Verificar se o IP está na whitelist
  SELECT EXISTS (
    SELECT 1 FROM public.ip_whitelist
    WHERE ip_address = _ip_address
  ) INTO v_is_whitelisted;

  -- Se está na whitelist, retornar imediatamente sem bloqueio
  IF v_is_whitelisted THEN
    RETURN jsonb_build_object(
      'suspicious', false,
      'should_block', false,
      'alert_admins', false,
      'attempt_count', 0,
      'whitelisted', true
    );
  END IF;

  -- Buscar registro existente
  SELECT * INTO v_existing_record
  FROM public.suspicious_login_attempts
  WHERE ip_address = _ip_address
  FOR UPDATE;

  IF v_existing_record IS NOT NULL THEN
    -- Atualizar tentativa existente
    v_attempt_count := v_existing_record.attempt_count + 1;
    
    UPDATE public.suspicious_login_attempts
    SET 
      attempt_count = v_attempt_count,
      last_attempt_at = now(),
      attempted_email = COALESCE(_email, attempted_email),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{last_emails}',
        COALESCE(metadata->'last_emails', '[]'::jsonb) || to_jsonb(ARRAY[_email])
      )
    WHERE ip_address = _ip_address;
  ELSE
    -- Criar novo registro
    v_attempt_count := 1;
    
    INSERT INTO public.suspicious_login_attempts (
      ip_address,
      attempted_email,
      attempt_count,
      metadata
    ) VALUES (
      _ip_address,
      _email,
      1,
      jsonb_build_object('last_emails', jsonb_build_array(_email))
    );
  END IF;

  -- Decidir se deve bloquear (5+ tentativas em 1 hora)
  IF v_attempt_count >= 5 THEN
    v_should_block := true;
    v_should_alert := true;
    
    -- Marcar como bloqueado
    UPDATE public.suspicious_login_attempts
    SET blocked = true, alert_sent = true
    WHERE ip_address = _ip_address;
    
    -- Adicionar à blacklist automaticamente
    INSERT INTO public.ip_blacklist (
      ip_address,
      reason,
      severity,
      auto_blocked,
      failed_attempts,
      last_attempt_at
    ) VALUES (
      _ip_address,
      'Bloqueio automático por múltiplas tentativas de login falhadas',
      'high',
      true,
      v_attempt_count,
      now()
    )
    ON CONFLICT (ip_address) DO UPDATE
    SET 
      failed_attempts = EXCLUDED.failed_attempts,
      last_attempt_at = EXCLUDED.last_attempt_at;
  ELSIF v_attempt_count >= 3 THEN
    -- Alertar admins a partir de 3 tentativas
    v_should_alert := true;
    
    UPDATE public.suspicious_login_attempts
    SET alert_sent = true
    WHERE ip_address = _ip_address AND alert_sent = false;
  END IF;

  RETURN jsonb_build_object(
    'suspicious', v_attempt_count >= 3,
    'should_block', v_should_block,
    'alert_admins', v_should_alert,
    'attempt_count', v_attempt_count,
    'whitelisted', false
  );
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ip_whitelist_updated_at
  BEFORE UPDATE ON public.ip_whitelist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();