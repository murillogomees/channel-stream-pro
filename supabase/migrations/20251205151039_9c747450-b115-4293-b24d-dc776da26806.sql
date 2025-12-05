-- Drop existing conflicting function first
DROP FUNCTION IF EXISTS public.verify_user_totp(UUID, TEXT);

-- Recreate the function with correct signature
CREATE OR REPLACE FUNCTION public.verify_user_totp(p_user_id UUID, p_totp_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_secret TEXT;
  is_enabled BOOLEAN;
BEGIN
  SELECT totp_secret, totp_enabled INTO stored_secret, is_enabled
  FROM public.user_totp_secrets
  WHERE user_id = p_user_id;
  
  IF NOT FOUND OR NOT is_enabled THEN
    RETURN false;
  END IF;
  
  RETURN stored_secret = p_totp_secret;
END;
$$;

-- Grant to service_role for Edge Functions
GRANT ALL ON FUNCTION public.verify_user_totp(UUID, TEXT) TO service_role;