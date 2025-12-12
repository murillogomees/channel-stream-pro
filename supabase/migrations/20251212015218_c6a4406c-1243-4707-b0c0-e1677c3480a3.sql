-- Create remote command audit table for SSH operations tracking
CREATE TABLE public.remote_command_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL,
  host TEXT NOT NULL,
  user_remote TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'prod')),
  key_source TEXT CHECK (key_source IN ('coolify', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'rolled_back')),
  details JSONB,
  error_message TEXT,
  backup_reference TEXT,
  executed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.remote_command_audit ENABLE ROW LEVEL SECURITY;

-- Only master users can view/insert audit logs
CREATE POLICY "Master users can view all audit logs"
  ON public.remote_command_audit
  FOR SELECT
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Master users can insert audit logs"
  ON public.remote_command_audit
  FOR INSERT
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_remote_command_audit_created_at ON public.remote_command_audit(created_at DESC);
CREATE INDEX idx_remote_command_audit_audit_id ON public.remote_command_audit(audit_id);