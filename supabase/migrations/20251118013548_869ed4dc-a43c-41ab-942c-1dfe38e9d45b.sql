-- Modificar função detect_permission_discrepancies para criar eventos de segurança
CREATE OR REPLACE FUNCTION public.detect_permission_discrepancies(
  _diagnostic_id uuid,
  _user_id uuid,
  _user_email text,
  _roles_table text[],
  _roles_rpc text[],
  _is_admin_rpc boolean,
  _auth_context_is_admin boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  has_discrepancy BOOLEAN := false;
  discrepancy_details JSONB := '[]'::jsonb;
  is_critical BOOLEAN := false;
BEGIN
  -- Discrepância 1: Diferença entre roles via tabela vs RPC
  IF _roles_table IS DISTINCT FROM _roles_rpc THEN
    has_discrepancy := true;
    discrepancy_details := discrepancy_details || jsonb_build_object(
      'type', 'roles_mismatch',
      'description', 'Roles via tabela diferem de roles via RPC',
      'roles_table', _roles_table,
      'roles_rpc', _roles_rpc
    );
    
    INSERT INTO public.permission_discrepancy_alerts (
      diagnostic_id, user_id, user_email,
      discrepancy_type, discrepancy_description, severity
    ) VALUES (
      _diagnostic_id, _user_id, _user_email,
      'roles_mismatch',
      format('Usuário %s tem roles diferentes via tabela (%s) vs RPC (%s)', 
        _user_email, 
        array_to_string(_roles_table, ', '), 
        array_to_string(_roles_rpc, ', ')
      ),
      'error'
    );
  END IF;
  
  -- Discrepância 2: is_admin RPC diferente de AuthContext (CRÍTICO)
  IF _is_admin_rpc IS DISTINCT FROM _auth_context_is_admin THEN
    has_discrepancy := true;
    is_critical := true;
    discrepancy_details := discrepancy_details || jsonb_build_object(
      'type', 'admin_status_mismatch',
      'description', 'Status de admin RPC difere do AuthContext',
      'is_admin_rpc', _is_admin_rpc,
      'auth_context_is_admin', _auth_context_is_admin
    );
    
    INSERT INTO public.permission_discrepancy_alerts (
      diagnostic_id, user_id, user_email,
      discrepancy_type, discrepancy_description, severity
    ) VALUES (
      _diagnostic_id, _user_id, _user_email,
      'admin_status_mismatch',
      format('Usuário %s: is_admin RPC (%s) difere do AuthContext (%s)', 
        _user_email, _is_admin_rpc, _auth_context_is_admin
      ),
      'critical'
    );
  END IF;
  
  -- Atualizar diagnóstico com informações de discrepância
  IF has_discrepancy THEN
    UPDATE public.permission_diagnostics
    SET 
      has_discrepancy = true,
      discrepancy_details = discrepancy_details
    WHERE id = _diagnostic_id;
    
    -- Se for crítico, criar evento de segurança para notificação WhatsApp
    IF is_critical THEN
      INSERT INTO public.security_events (
        event_type,
        severity,
        user_id,
        target_user_id,
        event_details
      ) VALUES (
        'permission_change',
        'critical',
        _user_id,
        _user_id,
        jsonb_build_object(
          'diagnostic_id', _diagnostic_id,
          'user_email', _user_email,
          'discrepancy_type', 'admin_status_mismatch',
          'description', 'Discrepância crítica de permissão detectada',
          'discrepancies', discrepancy_details,
          'timestamp', now()
        )
      );
    END IF;
  END IF;
END;
$function$;