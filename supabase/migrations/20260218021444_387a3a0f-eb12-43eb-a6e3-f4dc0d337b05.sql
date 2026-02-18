
-- Fix: replace partial unique index with full unique constraint for ON CONFLICT to work
DROP INDEX IF EXISTS public.sigma_blaze_clients_sigma_id_unique;
ALTER TABLE public.sigma_blaze_clients ADD CONSTRAINT sigma_blaze_clients_sigma_id_key UNIQUE (sigma_id);

-- Populate sigma_blaze_clients from existing profiles
INSERT INTO public.sigma_blaze_clients (sigma_id, name, whatsapp, email, plan_name, plan_value, expiration_date, status, notes, created_at, updated_at)
SELECT 
  p.id::text AS sigma_id,
  COALESCE(p.nome, split_part(p.email, '@', 1)) AS name,
  COALESCE(p.contact_phone, '') AS whatsapp,
  p.email,
  COALESCE(p.plano, 'Blaze IPTV') AS plan_name,
  COALESCE(p.valor_pago, 0) AS plan_value,
  COALESCE(p.data_vencimento::timestamptz, now() + interval '30 days') AS expiration_date,
  CASE WHEN p.cliente_ativo = true THEN 'active' ELSE 'inactive' END AS status,
  p.situacao AS notes,
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

-- Create trigger function to auto-sync new/updated profiles to sigma_blaze_clients
CREATE OR REPLACE FUNCTION public.sync_profile_to_sigma_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.sigma_blaze_clients (sigma_id, name, whatsapp, email, plan_name, plan_value, expiration_date, status, notes, created_at, updated_at)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.nome, split_part(NEW.email, '@', 1)),
    COALESCE(NEW.contact_phone, ''),
    NEW.email,
    COALESCE(NEW.plano, 'Blaze IPTV'),
    COALESCE(NEW.valor_pago, 0),
    COALESCE(NEW.data_vencimento::timestamptz, now() + interval '30 days'),
    CASE WHEN NEW.cliente_ativo = true THEN 'active' ELSE 'inactive' END,
    NEW.situacao,
    COALESCE(NEW.created_at, now()),
    now()
  )
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
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trg_sync_profile_to_sigma ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_sigma
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_sigma_clients();
