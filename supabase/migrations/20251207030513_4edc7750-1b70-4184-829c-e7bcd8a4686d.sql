-- Atualiza funções SQL para usar profiles ao invés de clientes

-- user_has_valid_access agora usa profiles
CREATE OR REPLACE FUNCTION public.user_has_valid_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND cliente_ativo = true
      AND (data_vencimento IS NULL OR data_vencimento >= now())
  )
$$;

-- user_access_days_remaining agora usa profiles
CREATE OR REPLACE FUNCTION public.user_access_days_remaining(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    GREATEST(0, EXTRACT(DAY FROM (data_vencimento - now()))::integer),
    0
  )
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- check_stream_limit agora usa profiles
CREATE OR REPLACE FUNCTION public.check_stream_limit(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan TEXT; v_max INTEGER; v_count INTEGER;
BEGIN
  SELECT plano INTO v_plan FROM profiles WHERE id = p_user_id;
  SELECT max_concurrent_streams INTO v_max FROM stream_limits WHERE plan_type = v_plan;
  v_max := COALESCE(v_max, 2);
  SELECT COUNT(*) INTO v_count FROM active_streams WHERE user_id = p_user_id AND last_heartbeat > now() - interval '2 minutes';
  RETURN jsonb_build_object('can_stream', v_count < v_max, 'active', v_count, 'max', v_max);
END;
$$;