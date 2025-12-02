-- ============================================
-- MIGRATIONS AUTOMATION - Schema Tracking
-- ============================================

-- Table to track applied migrations and their status
CREATE TABLE IF NOT EXISTS public.schema_migrations_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_file TEXT NOT NULL UNIQUE,
  migration_name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'failed', 'rolled_back')),
  checksum TEXT NOT NULL, -- SHA-256 of migration content
  execution_time_ms INTEGER,
  error_message TEXT,
  rollback_sql TEXT, -- For automatic rollback capability
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table to track schema state and detect drift
CREATE TABLE IF NOT EXISTS public.schema_expected_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL CHECK (object_type IN ('table', 'column', 'index', 'function', 'policy', 'trigger', 'constraint')),
  object_schema TEXT NOT NULL DEFAULT 'public',
  object_name TEXT NOT NULL,
  parent_object TEXT, -- For columns, indexes, etc.
  definition TEXT NOT NULL, -- Expected DDL or structure
  is_critical BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 5, -- 1-10, higher = more critical
  check_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(object_type, object_schema, object_name, parent_object)
);

-- Table to log schema drift detections
CREATE TABLE IF NOT EXISTS public.schema_drift_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL, -- Groups findings from same scan
  object_type TEXT NOT NULL,
  object_name TEXT NOT NULL,
  drift_type TEXT NOT NULL CHECK (drift_type IN ('missing', 'extra', 'modified', 'outdated')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  current_state TEXT,
  expected_state TEXT,
  fix_sql TEXT, -- Suggested SQL to fix
  fix_applied BOOLEAN NOT NULL DEFAULT false,
  fix_applied_at TIMESTAMPTZ,
  fix_applied_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.schema_migrations_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_expected_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_drift_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin and Master access only
CREATE POLICY "Admin and Master full access schema_migrations_tracking"
ON public.schema_migrations_tracking
FOR ALL
USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin and Master full access schema_expected_state"
ON public.schema_expected_state
FOR ALL
USING (is_admin_or_master(auth.uid()));

CREATE POLICY "Admin and Master full access schema_drift_log"
ON public.schema_drift_log
FOR ALL
USING (is_admin_or_master(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_migrations_tracking_file ON public.schema_migrations_tracking(migration_file);
CREATE INDEX idx_migrations_tracking_status ON public.schema_migrations_tracking(status);
CREATE INDEX idx_migrations_tracking_applied_at ON public.schema_migrations_tracking(applied_at DESC);

CREATE INDEX idx_expected_state_type ON public.schema_expected_state(object_type);
CREATE INDEX idx_expected_state_name ON public.schema_expected_state(object_name);
CREATE INDEX idx_expected_state_critical ON public.schema_expected_state(is_critical) WHERE is_critical = true;

CREATE INDEX idx_drift_log_scan ON public.schema_drift_log(scan_id);
CREATE INDEX idx_drift_log_type ON public.schema_drift_log(drift_type);
CREATE INDEX idx_drift_log_severity ON public.schema_drift_log(severity);
CREATE INDEX idx_drift_log_unresolved ON public.schema_drift_log(created_at DESC) WHERE resolved_at IS NULL;

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_migrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_schema_migrations_tracking_updated_at
  BEFORE UPDATE ON public.schema_migrations_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_migrations_updated_at();

CREATE TRIGGER update_schema_expected_state_updated_at
  BEFORE UPDATE ON public.schema_expected_state
  FOR EACH ROW
  EXECUTE FUNCTION update_migrations_updated_at();

-- Function to scan for schema drift
CREATE OR REPLACE FUNCTION scan_schema_drift()
RETURNS TABLE(
  drift_count BIGINT,
  critical_count BIGINT,
  high_count BIGINT,
  scan_id UUID
) AS $$
DECLARE
  v_scan_id UUID;
BEGIN
  v_scan_id := gen_random_uuid();
  
  -- This is a placeholder - actual drift detection logic
  -- will be implemented in the Edge Function for performance
  
  RETURN QUERY
  SELECT 
    COUNT(*) as drift_count,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE severity = 'high') as high_count,
    v_scan_id
  FROM public.schema_drift_log
  WHERE resolved_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;