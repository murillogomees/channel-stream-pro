-- Fix security definer views by recreating with security_invoker
DROP VIEW IF EXISTS public.profile_identities;
DROP VIEW IF EXISTS public.profile_sessions;

-- Recreate with SECURITY INVOKER (default, safe)
CREATE VIEW public.profile_identities 
WITH (security_invoker = true)
AS
SELECT 
  p.id as profile_id,
  p.nome,
  p.email as profile_email,
  i.id as identity_id,
  i.provider,
  i.identity_data,
  i.created_at as identity_created_at,
  i.updated_at as identity_updated_at,
  i.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.identities i ON i.user_id = p.id;

CREATE VIEW public.profile_sessions 
WITH (security_invoker = true)
AS
SELECT 
  p.id as profile_id,
  p.nome,
  p.email,
  s.id as session_id,
  s.created_at as session_created_at,
  s.updated_at as session_updated_at,
  s.factor_id,
  s.aal,
  s.not_after,
  s.refreshed_at,
  s.user_agent,
  s.ip
FROM public.profiles p
LEFT JOIN auth.sessions s ON s.user_id = p.id;

-- Grant select to authenticated users
GRANT SELECT ON public.profile_identities TO authenticated;
GRANT SELECT ON public.profile_sessions TO authenticated;