-- Tabela para histórico de diagnósticos de permissões
CREATE TABLE IF NOT EXISTS public.permission_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Resultados do diagnóstico
  session_active BOOLEAN,
  roles_via_table TEXT[],
  roles_via_rpc TEXT[],
  is_admin_rpc BOOLEAN,
  auth_context_is_admin BOOLEAN,
  auth_context_is_super_admin BOOLEAN,
  auth_context_is_client BOOLEAN,
  jwt_role TEXT,
  
  -- Detecção de discrepâncias
  has_discrepancy BOOLEAN NOT NULL DEFAULT false,
  discrepancy_details JSONB,
  
  -- Dados completos para análise
  full_diagnostic_data JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_permission_diagnostics_user_id ON public.permission_diagnostics(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_diagnostics_executed_at ON public.permission_diagnostics(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_diagnostics_has_discrepancy ON public.permission_diagnostics(has_discrepancy) WHERE has_discrepancy = true;

-- RLS Policies
ALTER TABLE public.permission_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar diagnósticos"
  ON public.permission_diagnostics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir diagnósticos"
  ON public.permission_diagnostics
  FOR INSERT
  WITH CHECK (true);

-- Tabela para alertas de discrepâncias
CREATE TABLE IF NOT EXISTS public.permission_discrepancy_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id UUID REFERENCES public.permission_diagnostics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  
  discrepancy_type TEXT NOT NULL,
  discrepancy_description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning', -- info, warning, error, critical
  
  -- Status do alerta
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  
  -- Notificações
  admins_notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_discrepancy_alerts_user_id ON public.permission_discrepancy_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_alerts_resolved ON public.permission_discrepancy_alerts(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_discrepancy_alerts_severity ON public.permission_discrepancy_alerts(severity);

-- RLS Policies
ALTER TABLE public.permission_discrepancy_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar alertas"
  ON public.permission_discrepancy_alerts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Função para detectar e criar alertas de discrepâncias
CREATE OR REPLACE FUNCTION public.detect_permission_discrepancies(
  _diagnostic_id UUID,
  _user_id UUID,
  _user_email TEXT,
  _roles_table TEXT[],
  _roles_rpc TEXT[],
  _is_admin_rpc BOOLEAN,
  _auth_context_is_admin BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_discrepancy BOOLEAN := false;
  discrepancy_details JSONB := '[]'::jsonb;
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
  
  -- Discrepância 2: is_admin RPC diferente de AuthContext
  IF _is_admin_rpc IS DISTINCT FROM _auth_context_is_admin THEN
    has_discrepancy := true;
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
  END IF;
END;
$$;

COMMENT ON TABLE public.permission_diagnostics IS 'Histórico de diagnósticos de permissões executados';
COMMENT ON TABLE public.permission_discrepancy_alerts IS 'Alertas de discrepâncias detectadas em permissões';