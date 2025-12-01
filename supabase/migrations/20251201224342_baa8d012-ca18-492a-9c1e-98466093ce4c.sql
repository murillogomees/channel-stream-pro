-- Fix migration_audit table structure and add sample data
-- This ensures the audit log works properly

-- First, ensure the table exists with correct structure
CREATE TABLE IF NOT EXISTS public.migration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  rows_affected INTEGER,
  rollback_available BOOLEAN DEFAULT true,
  rollback_executed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back'))
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_migration_audit_name ON public.migration_audit(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_audit_status ON public.migration_audit(status);
CREATE INDEX IF NOT EXISTS idx_migration_audit_executed_at ON public.migration_audit(executed_at DESC);

-- Enable RLS
ALTER TABLE public.migration_audit ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can view migration audit" ON public.migration_audit;
DROP POLICY IF EXISTS "Admins can insert migration audit" ON public.migration_audit;
DROP POLICY IF EXISTS "Admins can update migration audit" ON public.migration_audit;
DROP POLICY IF EXISTS "System can insert migration audit" ON public.migration_audit;

-- Policy: admins can view all migration audits
CREATE POLICY "Admins can view migration audit"
ON public.migration_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: admins can insert migration audits
CREATE POLICY "Admins can insert migration audit"
ON public.migration_audit FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: system can insert migration audits (for automated processes)
CREATE POLICY "System can insert migration audit"
ON public.migration_audit FOR INSERT
WITH CHECK (true);

-- Policy: admins can update migration audits (for rollback tracking)
CREATE POLICY "Admins can update migration audit"
ON public.migration_audit FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert sample migration audit entries for testing
INSERT INTO public.migration_audit (
  migration_name,
  executed_at,
  status,
  duration_ms,
  rows_affected,
  metadata
) VALUES
(
  'initial_schema_setup',
  NOW() - INTERVAL '7 days',
  'completed',
  2450,
  156,
  '{"tables_created": 25, "indexes_created": 48}'::jsonb
),
(
  'add_m3u_custom_lists',
  NOW() - INTERVAL '5 days',
  'completed',
  1820,
  89,
  '{"tables_created": 3, "columns_added": 12}'::jsonb
),
(
  'migration_audit_infrastructure',
  NOW() - INTERVAL '3 days',
  'completed',
  980,
  45,
  '{"feature_flags_created": 5, "audit_table_created": true}'::jsonb
),
(
  'cdn_prewarm_system',
  NOW() - INTERVAL '2 days',
  'completed',
  3210,
  234,
  '{"tables_created": 4, "functions_created": 2}'::jsonb
),
(
  'security_enhancements',
  NOW() - INTERVAL '1 day',
  'completed',
  1560,
  67,
  '{"policies_updated": 18, "triggers_added": 3}'::jsonb
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.migration_audit IS 'Tracks all database migrations with execution status, timing, and metadata';
COMMENT ON COLUMN public.migration_audit.migration_name IS 'Unique name identifier for the migration';
COMMENT ON COLUMN public.migration_audit.status IS 'Current status: pending, running, completed, failed, or rolled_back';
COMMENT ON COLUMN public.migration_audit.duration_ms IS 'Total execution time in milliseconds';
COMMENT ON COLUMN public.migration_audit.rows_affected IS 'Number of rows modified by the migration';
COMMENT ON COLUMN public.migration_audit.metadata IS 'Additional migration metadata in JSON format';