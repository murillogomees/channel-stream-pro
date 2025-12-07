-- Recreate the update_r2_config function with proper auth handling
CREATE OR REPLACE FUNCTION update_r2_config(p_key TEXT, p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- If no auth context (service role), allow
  -- Otherwise check if admin/master
  IF v_user_id IS NOT NULL AND NOT is_admin_or_master(v_user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE r2_migration_config 
  SET value = p_value, updated_at = now(), updated_by = v_user_id
  WHERE key = p_key;
  
  RETURN FOUND;
END;
$$;