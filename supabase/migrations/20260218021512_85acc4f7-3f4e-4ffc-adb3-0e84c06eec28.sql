
CREATE OR REPLACE FUNCTION public.sync_profiles_to_sigma_clients()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_synced INTEGER;
BEGIN
  INSERT INTO public.sigma_blaze_clients (sigma_id, name, whatsapp, email, plan_name, plan_value, expiration_date, status, notes, created_at, updated_at)
  SELECT 
    p.id::text,
    COALESCE(p.nome, split_part(p.email, '@', 1)),
    COALESCE(p.contact_phone, ''),
    p.email,
    COALESCE(p.plano, 'Blaze IPTV'),
    COALESCE(p.valor_pago, 0),
    COALESCE(p.data_vencimento::timestamptz, now() + interval '30 days'),
    CASE WHEN p.cliente_ativo = true THEN 'active' ELSE 'inactive' END,
    p.situacao,
    p.created_at,
    now()
  FROM public.profiles p
  ON CONFLICT (sigma_id) DO UPDATE SET
    name = EXCLUDED.name,
    whatsapp = EXCLUDED.whatsapp,
    email = EXCLUDED.email,
    plan_name = EXCLUDED.plan_name,
    plan_value = EXCLUDED.plan_value,
    expiration_date = EXCLUDED.expiration_date,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    updated_at = now();
  
  GET DIAGNOSTICS v_synced = ROW_COUNT;
  RETURN v_synced;
END;
$$;
