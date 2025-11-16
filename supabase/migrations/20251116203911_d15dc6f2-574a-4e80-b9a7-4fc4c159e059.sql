-- Create security events table for monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,  -- 'failed_login', 'permission_change', 'suspicious_activity', 'rate_limit_exceeded', 'unauthorized_access'
  severity TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warning', 'critical'
  user_id UUID,  -- NULL if unauthenticated attempt
  target_user_id UUID,  -- For permission changes, the affected user
  ip_address TEXT,
  user_agent TEXT,
  event_details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can view security events"
  ON public.security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update security events"
  ON public.security_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert (for Edge Functions)
CREATE POLICY "Service can insert security events"
  ON public.security_events
  FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_resolved ON public.security_events(resolved, created_at DESC);

-- Function to auto-log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if role actually changed (for updates) or for new inserts
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.role != NEW.role) THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      user_id,
      target_user_id,
      event_details
    ) VALUES (
      'permission_change',
      'warning',
      auth.uid(),
      NEW.user_id,
      jsonb_build_object(
        'action', TG_OP,
        'new_role', NEW.role,
        'old_role', CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE null END,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for role changes
DROP TRIGGER IF EXISTS trigger_log_role_change ON public.user_roles;
CREATE TRIGGER trigger_log_role_change
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

-- Enable realtime for security_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;

-- Function to cleanup old resolved events (older than 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.security_events
  WHERE resolved = true 
    AND created_at < now() - interval '90 days';
END;
$$;