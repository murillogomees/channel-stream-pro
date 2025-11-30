-- =====================================================
-- FASE 8: Migration Audit & Cleanup Infrastructure
-- Description: Creates infrastructure for safe migrations
-- Reversible: YES (down script included in comments)
-- =====================================================

-- 1. Create migration_audit table for tracking migrations
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

-- Create indexes for migration_audit
CREATE INDEX IF NOT EXISTS idx_migration_audit_name ON public.migration_audit(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_audit_status ON public.migration_audit(status);
CREATE INDEX IF NOT EXISTS idx_migration_audit_executed_at ON public.migration_audit(executed_at DESC);

-- Enable RLS on migration_audit
ALTER TABLE public.migration_audit ENABLE ROW LEVEL SECURITY;

-- Policy: admins can view all migration audits
CREATE POLICY "Admins can view migration audit"
ON public.migration_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: system/admins can insert migration audits
CREATE POLICY "Admins can insert migration audit"
ON public.migration_audit FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: admins can update migration audits (for rollback tracking)
CREATE POLICY "Admins can update migration audit"
ON public.migration_audit FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. Create feature_flag_config table for persisted flags
CREATE TABLE IF NOT EXISTS public.feature_flag_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  percentage INTEGER NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  target_devices TEXT[] DEFAULT '{}',
  target_users UUID[] DEFAULT '{}',
  description TEXT,
  rollback_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index for feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flag_config_name ON public.feature_flag_config(flag_name);

-- Enable RLS on feature_flag_config
ALTER TABLE public.feature_flag_config ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read feature flags
CREATE POLICY "Anyone can read feature flags"
ON public.feature_flag_config FOR SELECT
USING (true);

-- Policy: only admins can modify feature flags
CREATE POLICY "Admins can modify feature flags"
ON public.feature_flag_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_feature_flag_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_feature_flag_config_updated_at ON public.feature_flag_config;
CREATE TRIGGER update_feature_flag_config_updated_at
BEFORE UPDATE ON public.feature_flag_config
FOR EACH ROW
EXECUTE FUNCTION public.update_feature_flag_updated_at();

-- 3. Insert default migration flags
INSERT INTO public.feature_flag_config (flag_name, enabled, percentage, description)
VALUES 
  ('use_cliente_db_only', false, 0, 'Use ClienteDb instead of legacy Cliente type'),
  ('disable_legacy_routes', false, 0, 'Disable redirects to legacy admin routes'),
  ('consolidated_whatsapp', true, 100, 'Use consolidated WhatsApp service'),
  ('new_notification_system', true, 100, 'Use modular notification system'),
  ('enhanced_abr', true, 100, 'Enhanced ABR with aggressive up-switch'),
  ('segment_prefetch', true, 100, 'Prefetch HLS segments on hover/start'),
  ('resume_support', true, 100, 'Resume playback from last position'),
  ('player_analytics', true, 100, 'Send player events to analytics'),
  ('new_home_ui', true, 100, 'New Netflix-style home page UI'),
  ('new_detail_ui', true, 100, 'New content detail sheet UI'),
  ('new_mylist_ui', true, 100, 'New My List page UI'),
  ('web_vitals_tracking', true, 100, 'Track Core Web Vitals'),
  ('tv_optimizations', true, 100, 'TV-specific optimizations')
ON CONFLICT (flag_name) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. Create cleanup function for old data
CREATE OR REPLACE FUNCTION public.cleanup_fase8_old_data(p_dry_run BOOLEAN DEFAULT true)
RETURNS TABLE(
  table_name TEXT,
  rows_deleted BIGINT,
  action TEXT
) AS $$
DECLARE
  v_notification_logs_count BIGINT := 0;
  v_security_events_count BIGINT := 0;
  v_rate_limit_count BIGINT := 0;
  v_import_cache_count BIGINT := 0;
  v_suspicious_count BIGINT := 0;
BEGIN
  -- Count rows to delete
  SELECT COUNT(*) INTO v_notification_logs_count
  FROM notification_logs WHERE created_at < NOW() - INTERVAL '90 days';
  
  SELECT COUNT(*) INTO v_security_events_count
  FROM security_events WHERE resolved = true AND created_at < NOW() - INTERVAL '90 days';
  
  SELECT COUNT(*) INTO v_rate_limit_count
  FROM rate_limit_tracking WHERE window_start < NOW() - INTERVAL '1 hour';
  
  SELECT COUNT(*) INTO v_import_cache_count
  FROM m3u_import_cache WHERE last_used_at < NOW() - INTERVAL '30 days';
  
  SELECT COUNT(*) INTO v_suspicious_count
  FROM suspicious_login_attempts WHERE created_at < NOW() - INTERVAL '30 days';

  IF NOT p_dry_run THEN
    -- Actually delete data
    DELETE FROM notification_logs WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM security_events WHERE resolved = true AND created_at < NOW() - INTERVAL '90 days';
    DELETE FROM rate_limit_tracking WHERE window_start < NOW() - INTERVAL '1 hour';
    DELETE FROM m3u_import_cache WHERE last_used_at < NOW() - INTERVAL '30 days';
    DELETE FROM suspicious_login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Update statistics
    ANALYZE notification_logs;
    ANALYZE security_events;
    ANALYZE rate_limit_tracking;
    ANALYZE m3u_import_cache;
    ANALYZE suspicious_login_attempts;
  END IF;

  -- Return results
  RETURN QUERY SELECT 'notification_logs'::TEXT, v_notification_logs_count, 
    CASE WHEN p_dry_run THEN 'dry_run' ELSE 'deleted' END;
  RETURN QUERY SELECT 'security_events'::TEXT, v_security_events_count,
    CASE WHEN p_dry_run THEN 'dry_run' ELSE 'deleted' END;
  RETURN QUERY SELECT 'rate_limit_tracking'::TEXT, v_rate_limit_count,
    CASE WHEN p_dry_run THEN 'dry_run' ELSE 'deleted' END;
  RETURN QUERY SELECT 'm3u_import_cache'::TEXT, v_import_cache_count,
    CASE WHEN p_dry_run THEN 'dry_run' ELSE 'deleted' END;
  RETURN QUERY SELECT 'suspicious_login_attempts'::TEXT, v_suspicious_count,
    CASE WHEN p_dry_run THEN 'dry_run' ELSE 'deleted' END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create function to get migration status
CREATE OR REPLACE FUNCTION public.get_migration_status()
RETURNS TABLE(
  flag_name VARCHAR,
  enabled BOOLEAN,
  percentage INTEGER,
  last_updated TIMESTAMPTZ,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.flag_name,
    f.enabled,
    f.percentage,
    f.updated_at as last_updated,
    f.description
  FROM public.feature_flag_config f
  ORDER BY f.flag_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create function to toggle feature flag
CREATE OR REPLACE FUNCTION public.toggle_feature_flag(
  p_flag_name VARCHAR,
  p_enabled BOOLEAN,
  p_percentage INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE public.feature_flag_config
  SET 
    enabled = p_enabled,
    percentage = COALESCE(p_percentage, CASE WHEN p_enabled THEN 100 ELSE 0 END),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE flag_name = p_flag_name;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Log the change
  INSERT INTO public.migration_audit (
    migration_name,
    executed_by,
    status,
    metadata
  ) VALUES (
    'toggle_flag_' || p_flag_name,
    auth.uid(),
    'completed',
    jsonb_build_object(
      'flag_name', p_flag_name,
      'enabled', p_enabled,
      'percentage', COALESCE(p_percentage, CASE WHEN p_enabled THEN 100 ELSE 0 END)
    )
  );
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- DOWN SCRIPT (for rollback):
-- =====================================================
-- DROP FUNCTION IF EXISTS public.toggle_feature_flag(VARCHAR, BOOLEAN, INTEGER);
-- DROP FUNCTION IF EXISTS public.get_migration_status();
-- DROP FUNCTION IF EXISTS public.cleanup_fase8_old_data(BOOLEAN);
-- DROP TRIGGER IF EXISTS update_feature_flag_config_updated_at ON public.feature_flag_config;
-- DROP FUNCTION IF EXISTS public.update_feature_flag_updated_at();
-- DROP TABLE IF EXISTS public.feature_flag_config;
-- DROP TABLE IF EXISTS public.migration_audit;