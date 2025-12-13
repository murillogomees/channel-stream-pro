-- ============================================================================
-- SECURITY TABLES FOR CUSTOM AUTH
-- Rate Limiting, Brute Force Protection, Refresh Token Rotation, Session Management
-- ============================================================================

-- 1. Rate Limit Tracking Table
CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL DEFAULT 'ip', -- 'ip', 'email', 'user_id'
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_duration_seconds INTEGER DEFAULT 60,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, identifier_type, window_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON public.rate_limit_tracking(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_tracking(window_start);

-- Enable RLS
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Only admins can view rate limits
CREATE POLICY "Admins can manage rate limits"
  ON public.rate_limit_tracking FOR ALL
  USING (is_admin_or_master());

-- System can insert rate limits
CREATE POLICY "System can insert rate limits"
  ON public.rate_limit_tracking FOR INSERT
  WITH CHECK (true);

-- 2. Refresh Tokens Table (for token rotation)
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  family_id UUID NOT NULL, -- Group of related tokens
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON public.refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON public.refresh_tokens(token_hash);

-- Enable RLS
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view own refresh tokens"
  ON public.refresh_tokens FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_master());

-- Only system can manage tokens
CREATE POLICY "System can manage refresh tokens"
  ON public.refresh_tokens FOR ALL
  USING (is_admin_or_master());

-- 3. User Sessions Table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  refresh_token_id UUID REFERENCES public.refresh_tokens(id),
  device_info JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id OR is_admin_or_master());

-- Users can update their own sessions (logout)
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id OR is_admin_or_master());

-- System can manage sessions
CREATE POLICY "System can manage sessions"
  ON public.user_sessions FOR ALL
  USING (is_admin_or_master());

-- 4. Security Events Table (if not exists)
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'failed_login', 'brute_force_block', 'token_reuse_detected', etc.
  event_details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  user_id UUID,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events
CREATE POLICY "Admins can manage security events"
  ON public.security_events FOR ALL
  USING (is_admin_or_master());

-- System can insert security events
CREATE POLICY "System can insert security events"
  ON public.security_events FOR INSERT
  WITH CHECK (true);

-- 5. Add columns to ip_blacklist if not exists
ALTER TABLE public.ip_blacklist 
  ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';

-- 6. Helper function to check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_identifier_type TEXT DEFAULT 'ip',
  p_limit INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Get current count within window
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.rate_limit_tracking
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND window_start > v_window_start;
  
  -- Insert/update tracking
  INSERT INTO public.rate_limit_tracking (identifier, identifier_type, request_count, window_start, window_duration_seconds)
  VALUES (p_identifier, p_identifier_type, 1, NOW(), p_window_seconds)
  ON CONFLICT (identifier, identifier_type, window_start) 
  DO UPDATE SET request_count = rate_limit_tracking.request_count + 1, last_request_at = NOW();
  
  RETURN QUERY SELECT 
    (v_count + 1) <= p_limit,
    v_count + 1,
    NOW() + (p_window_seconds || ' seconds')::INTERVAL;
END;
$$;

-- 7. Helper function to check if IP/email is blocked
CREATE OR REPLACE FUNCTION public.is_blocked(p_identifier TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blacklist
    WHERE ip_address = p_identifier
      AND unblocked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- 8. Helper function to auto-block after threshold
CREATE OR REPLACE FUNCTION public.auto_block_identifier(
  p_identifier TEXT,
  p_failed_attempts INTEGER,
  p_reason TEXT DEFAULT 'brute_force'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block_duration INTERVAL;
  v_severity TEXT;
BEGIN
  -- Determine block duration based on attempts
  IF p_failed_attempts >= 50 THEN
    v_block_duration := INTERVAL '7 days'; -- Permanent-ish
    v_severity := 'critical';
  ELSIF p_failed_attempts >= 20 THEN
    v_block_duration := INTERVAL '24 hours';
    v_severity := 'high';
  ELSIF p_failed_attempts >= 10 THEN
    v_block_duration := INTERVAL '1 hour';
    v_severity := 'medium';
  ELSE
    v_block_duration := INTERVAL '15 minutes';
    v_severity := 'low';
  END IF;

  INSERT INTO public.ip_blacklist (ip_address, reason, auto_blocked, failed_attempts, last_attempt_at, expires_at, severity)
  VALUES (p_identifier, p_reason, true, p_failed_attempts, NOW(), NOW() + v_block_duration, v_severity)
  ON CONFLICT (ip_address) DO UPDATE SET
    failed_attempts = EXCLUDED.failed_attempts,
    last_attempt_at = NOW(),
    expires_at = NOW() + v_block_duration,
    severity = EXCLUDED.severity;
  
  -- Log security event
  INSERT INTO public.security_events (event_type, event_details, ip_address, severity)
  VALUES ('auto_block', jsonb_build_object('reason', p_reason, 'attempts', p_failed_attempts), p_identifier, v_severity);
END;
$$;

-- 9. Cleanup old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_tracking
  WHERE window_start < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 10. Revoke all tokens in a family (for token reuse detection)
CREATE OR REPLACE FUNCTION public.revoke_token_family(p_family_id UUID, p_reason TEXT DEFAULT 'security')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revoked INTEGER;
BEGIN
  UPDATE public.refresh_tokens
  SET is_revoked = true, revoked_at = NOW(), revoked_reason = p_reason
  WHERE family_id = p_family_id AND is_revoked = false;
  
  GET DIAGNOSTICS v_revoked = ROW_COUNT;
  
  -- Log security event
  IF v_revoked > 0 THEN
    INSERT INTO public.security_events (event_type, event_details, severity)
    VALUES ('token_family_revoked', jsonb_build_object('family_id', p_family_id, 'reason', p_reason, 'tokens_revoked', v_revoked), 'high');
  END IF;
  
  RETURN v_revoked;
END;
$$;