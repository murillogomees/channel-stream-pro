-- Drop the old function signature to avoid ambiguity
DROP FUNCTION IF EXISTS public.execute_sql_as_service_role(text);

-- Keep only the version with caller_user_id parameter (already exists)