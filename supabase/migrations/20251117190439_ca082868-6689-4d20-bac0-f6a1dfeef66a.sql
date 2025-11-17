-- Adicionar suporte para 2FA
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS totp_secret TEXT,
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;

-- Criar tabela para tentativas de login suspeitas
CREATE TABLE IF NOT EXISTS public.suspicious_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  attempted_email TEXT,
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked BOOLEAN DEFAULT false,
  alert_sent BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_suspicious_login_ip ON public.suspicious_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_suspicious_login_blocked ON public.suspicious_login_attempts(blocked);
CREATE INDEX IF NOT EXISTS idx_suspicious_login_alert_sent ON public.suspicious_login_attempts(alert_sent);

-- RLS Policies
ALTER TABLE public.suspicious_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar tentativas suspeitas"
  ON public.suspicious_login_attempts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir tentativas suspeitas"
  ON public.suspicious_login_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar tentativas suspeitas"
  ON public.suspicious_login_attempts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Função para detectar tentativas suspeitas
CREATE OR REPLACE FUNCTION public.check_suspicious_login(_ip_address text, _email text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_record RECORD;
  v_is_suspicious BOOLEAN := false;
  v_should_block BOOLEAN := false;
  v_alert_admins BOOLEAN := false;
BEGIN
  -- Buscar registro existente nas últimas 24h
  SELECT * INTO v_attempt_record
  FROM public.suspicious_login_attempts
  WHERE ip_address = _ip_address
    AND last_attempt_at > now() - interval '24 hours'
  ORDER BY last_attempt_at DESC
  LIMIT 1;

  IF v_attempt_record IS NULL THEN
    -- Primeiro erro desse IP
    INSERT INTO public.suspicious_login_attempts (
      ip_address, 
      attempted_email, 
      attempt_count
    ) VALUES (
      _ip_address, 
      _email, 
      1
    );
    
    RETURN jsonb_build_object(
      'suspicious', false,
      'should_block', false,
      'attempt_count', 1
    );
  ELSE
    -- Atualizar contadores
    UPDATE public.suspicious_login_attempts
    SET 
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      attempted_email = COALESCE(_email, attempted_email)
    WHERE id = v_attempt_record.id;

    -- Determinar se é suspeito (3+ tentativas em 15 minutos)
    IF v_attempt_record.attempt_count >= 2 
       AND v_attempt_record.last_attempt_at > now() - interval '15 minutes' THEN
      v_is_suspicious := true;
      
      -- Alertar admins se ainda não foi alertado
      IF NOT v_attempt_record.alert_sent THEN
        v_alert_admins := true;
        
        UPDATE public.suspicious_login_attempts
        SET alert_sent = true
        WHERE id = v_attempt_record.id;
      END IF;
    END IF;

    -- Bloquear se 5+ tentativas em 1 hora
    IF v_attempt_record.attempt_count >= 4
       AND v_attempt_record.first_attempt_at > now() - interval '1 hour' THEN
      v_should_block := true;
      
      UPDATE public.suspicious_login_attempts
      SET blocked = true
      WHERE id = v_attempt_record.id;
      
      -- Auto-adicionar ao IP blacklist
      INSERT INTO public.ip_blacklist (
        ip_address,
        reason,
        severity,
        auto_blocked,
        failed_attempts,
        expires_at
      ) VALUES (
        _ip_address,
        'Múltiplas tentativas de login suspeitas',
        'high',
        true,
        v_attempt_record.attempt_count + 1,
        now() + interval '24 hours'
      )
      ON CONFLICT (ip_address) 
      DO UPDATE SET
        failed_attempts = ip_blacklist.failed_attempts + 1,
        last_attempt_at = now();
    END IF;

    RETURN jsonb_build_object(
      'suspicious', v_is_suspicious,
      'should_block', v_should_block,
      'alert_admins', v_alert_admins,
      'attempt_count', v_attempt_record.attempt_count + 1
    );
  END IF;
END;
$$;

-- Função para limpar registros antigos
CREATE OR REPLACE FUNCTION public.cleanup_old_suspicious_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.suspicious_login_attempts
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- Comentários
COMMENT ON TABLE public.suspicious_login_attempts IS 'Rastreamento de tentativas de login suspeitas para detecção de ameaças';
COMMENT ON FUNCTION public.check_suspicious_login IS 'Verifica e registra tentativas de login suspeitas, retornando se deve bloquear e alertar';