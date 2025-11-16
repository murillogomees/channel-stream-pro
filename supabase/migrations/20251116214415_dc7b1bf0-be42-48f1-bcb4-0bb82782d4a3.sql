-- Security hardening: Ensure all functions have proper search_path configuration
-- This prevents potential security issues from schema manipulation

-- 1. Update functions that don't have search_path or have incorrect configuration
CREATE OR REPLACE FUNCTION public.ensure_single_default_m3u()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.m3u_lists 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
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

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_tracking
  WHERE window_start < now() - interval '1 hour';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.metrics_snapshots 
  WHERE timestamp < now() - interval '30 days';
  
  DELETE FROM public.health_snapshots 
  WHERE timestamp < now() - interval '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Verify all security definer functions have proper search_path
COMMENT ON FUNCTION public.ensure_single_default_m3u IS 'Security hardened: search_path set to public';
COMMENT ON FUNCTION public.log_role_change IS 'Security hardened: search_path set to public';
COMMENT ON FUNCTION public.cleanup_old_security_events IS 'Security hardened: search_path set to public';
COMMENT ON FUNCTION public.cleanup_old_rate_limits IS 'Security hardened: search_path set to public';
COMMENT ON FUNCTION public.cleanup_old_metrics IS 'Security hardened: search_path set to public';
COMMENT ON FUNCTION public.update_updated_at_column IS 'Security hardened: search_path set to public';