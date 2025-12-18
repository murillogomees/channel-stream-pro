-- Fix linter warning: set immutable search_path on public.gen_random_uuid wrapper
CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS uuid
LANGUAGE sql
SET search_path = public, extensions
AS $$
  SELECT extensions.gen_random_uuid();
$$;