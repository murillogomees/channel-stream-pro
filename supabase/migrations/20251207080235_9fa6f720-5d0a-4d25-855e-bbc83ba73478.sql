-- Fix execute_sql_as_service_role to properly handle caller_user_id parameter
-- The issue is that service role client doesn't have auth.uid() so we must rely on the parameter

CREATE OR REPLACE FUNCTION public.execute_sql_as_service_role(
  sql_query text, 
  caller_user_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_master_or_admin BOOLEAN;
BEGIN
  -- For service role calls, auth.uid() will be NULL, so we must use caller_user_id
  -- Try parameter first (explicit), then auth.uid() (session-based)
  v_user_id := COALESCE(caller_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required - caller_user_id parameter is required when using service role';
  END IF;
  
  -- Check if user is master or admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id AND role IN ('master', 'admin')
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
    v_user_id,
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
    v_user_id,
    'sql_execution_failed',
    'SQL execution failed',
    jsonb_build_object('error', SQLERRM, 'sql_preview', left(sql_query, 200))
  );
  
  RAISE;
END;
$function$;