-- Fix execute_sql_as_service_role - make caller_user_id required (no DEFAULT)
-- This ensures PostgREST properly passes the parameter

DROP FUNCTION IF EXISTS public.execute_sql_as_service_role(text, uuid);

CREATE OR REPLACE FUNCTION public.execute_sql_as_service_role(
  sql_query text, 
  caller_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_master_or_admin BOOLEAN;
BEGIN
  -- Validate caller_user_id is provided
  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION 'caller_user_id parameter cannot be NULL';
  END IF;
  
  -- Check if user is master or admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = caller_user_id AND role IN ('master', 'admin')
  ) INTO v_is_master_or_admin;
  
  IF NOT v_is_master_or_admin THEN
    RAISE EXCEPTION 'Admin or Master role required to execute SQL';
  END IF;
  
  -- Log the execution attempt
  INSERT INTO activity_logs (
    user_id,
    action_type,
    action_description,
    metadata
  ) VALUES (
    caller_user_id,
    'sql_execution',
    'Executed SQL via execute_sql_as_service_role',
    jsonb_build_object('sql_preview', left(sql_query, 200))
  );
  
  -- Execute the query
  EXECUTE sql_query;
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO activity_logs (
    user_id,
    action_type,
    action_description,
    metadata
  ) VALUES (
    caller_user_id,
    'sql_execution_failed',
    'SQL execution failed',
    jsonb_build_object('error', SQLERRM, 'sql_preview', left(sql_query, 200))
  );
  
  RAISE;
END;
$function$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.execute_sql_as_service_role(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sql_as_service_role(text, uuid) TO service_role;