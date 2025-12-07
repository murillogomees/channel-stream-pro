-- Table to track RLS audit issue resolutions
CREATE TABLE IF NOT EXISTS public.rls_audit_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_hash TEXT NOT NULL UNIQUE, -- hash of table+policy+issue for deduplication
  table_name TEXT NOT NULL,
  policy_name TEXT,
  issue_type TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'resolved', 'ignored', 'false_positive')),
  resolution_type TEXT, -- 'auto_fix', 'manual_fix', 'acknowledged', 'ignored', 'false_positive'
  resolution_notes TEXT,
  suggested_fix TEXT, -- SQL to fix the issue
  applied_fix TEXT, -- SQL that was actually applied
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rls_audit_resolutions ENABLE ROW LEVEL SECURITY;

-- Only admins/masters can manage
CREATE POLICY "Admins and masters can manage RLS audit resolutions"
  ON public.rls_audit_resolutions
  FOR ALL
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_rls_audit_resolutions_status ON public.rls_audit_resolutions(status);
CREATE INDEX idx_rls_audit_resolutions_severity ON public.rls_audit_resolutions(severity);
CREATE INDEX idx_rls_audit_resolutions_table ON public.rls_audit_resolutions(table_name);

-- Trigger for updated_at
CREATE TRIGGER update_rls_audit_resolutions_updated_at
  BEFORE UPDATE ON public.rls_audit_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();