-- ============================================================================
-- Smart Cache Infrastructure
-- Migration: cache_rules + cache_stats + cache_invalidations
-- Purpose: Enable dynamic cache configuration and observability
-- ============================================================================

-- 1. Cache Rules Table (Configuration Storage)
CREATE TABLE IF NOT EXISTS public.cache_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  match_pattern TEXT NOT NULL, -- Regex or glob pattern for URL matching
  match_type TEXT NOT NULL DEFAULT 'path' CHECK (match_type IN ('path', 'host', 'query', 'header')),
  
  -- Cache behavior
  ttl INTEGER NOT NULL DEFAULT 3600, -- seconds
  stale_while_revalidate INTEGER DEFAULT 60, -- seconds
  stale_if_error INTEGER DEFAULT 86400, -- seconds
  
  -- Prioritization
  priority INTEGER NOT NULL DEFAULT 0, -- Higher = evaluated first
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Scope and targeting
  scope JSONB DEFAULT '{}', -- Additional matching criteria
  headers JSONB DEFAULT '{}', -- Custom headers to add
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_applied_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cache_rules_priority ON public.cache_rules(priority DESC, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_cache_rules_match_type ON public.cache_rules(match_type, enabled) WHERE enabled = true;

-- 2. Cache Statistics Table (Observability)
CREATE TABLE IF NOT EXISTS public.cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.cache_rules(id) ON DELETE CASCADE,
  
  -- Metrics window
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  
  -- Hit/Miss metrics
  hits BIGINT NOT NULL DEFAULT 0,
  misses BIGINT NOT NULL DEFAULT 0,
  stale_hits BIGINT NOT NULL DEFAULT 0, -- stale-while-revalidate served
  errors BIGINT NOT NULL DEFAULT 0,
  
  -- Performance metrics
  avg_response_time_ms NUMERIC(10,2),
  p95_response_time_ms NUMERIC(10,2),
  bandwidth_saved_bytes BIGINT DEFAULT 0,
  
  -- Status tracking
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(rule_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_cache_stats_window ON public.cache_stats(window_start DESC, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_cache_stats_rule ON public.cache_stats(rule_id, window_start DESC);

-- 3. Cache Invalidations Table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.cache_invalidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was invalidated
  pattern TEXT NOT NULL, -- URL pattern or key pattern
  invalidation_type TEXT NOT NULL CHECK (invalidation_type IN ('pattern', 'key', 'tag', 'all')),
  scope TEXT, -- Optional scope restriction
  
  -- Execution details
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Results
  keys_invalidated INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cache_invalidations_status ON public.cache_invalidations(status, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_invalidations_user ON public.cache_invalidations(initiated_by, initiated_at DESC);

-- ============================================================================
-- Triggers & Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_cache_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cache_rules_updated_at
  BEFORE UPDATE ON public.cache_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cache_rules_updated_at();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.cache_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_invalidations ENABLE ROW LEVEL SECURITY;

-- Admin/Master can manage cache rules
CREATE POLICY "Admin can manage cache rules"
ON public.cache_rules
FOR ALL
TO authenticated
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

-- Admin/Master can view all cache stats
CREATE POLICY "Admin can view cache stats"
ON public.cache_stats
FOR SELECT
TO authenticated
USING (is_admin_or_master(auth.uid()));

-- Admin/Master can view and create invalidations
CREATE POLICY "Admin can manage invalidations"
ON public.cache_invalidations
FOR ALL
TO authenticated
USING (is_admin_or_master(auth.uid()))
WITH CHECK (is_admin_or_master(auth.uid()));

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get cache coverage summary
CREATE OR REPLACE FUNCTION public.get_cache_coverage_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_rules', COUNT(*),
    'enabled_rules', COUNT(*) FILTER (WHERE enabled = true),
    'total_hits', COALESCE(SUM(cs.hits), 0),
    'total_misses', COALESCE(SUM(cs.misses), 0),
    'hit_rate', CASE 
      WHEN COALESCE(SUM(cs.hits), 0) + COALESCE(SUM(cs.misses), 0) > 0
      THEN ROUND((COALESCE(SUM(cs.hits), 0)::NUMERIC / (COALESCE(SUM(cs.hits), 0) + COALESCE(SUM(cs.misses), 0)) * 100), 2)
      ELSE 0
    END,
    'last_updated', MAX(cr.updated_at)
  ) INTO result
  FROM public.cache_rules cr
  LEFT JOIN public.cache_stats cs ON cr.id = cs.rule_id
    AND cs.window_start > NOW() - INTERVAL '24 hours';
  
  RETURN result;
END;
$$;

-- ============================================================================
-- Seed Default Rules
-- ============================================================================

INSERT INTO public.cache_rules (name, description, match_pattern, match_type, ttl, stale_while_revalidate, priority, enabled)
VALUES 
  ('HLS Manifests', 'Cache .m3u8 playlist files', '.*\\.m3u8$', 'path', 30, 10, 100, true),
  ('HLS Segments', 'Cache .ts video segments with immutable flag', '.*\\.ts$', 'path', 86400, 3600, 90, true),
  ('Static Assets', 'Cache images, CSS, JS with long TTL', '.*\\.(jpg|jpeg|png|gif|css|js|woff2)$', 'path', 604800, 86400, 80, true),
  ('API Responses', 'Short cache for API JSON responses', '^/api/.*', 'path', 60, 30, 50, false),
  ('CDN Objects', 'Cache R2 CDN objects', '.*/cdn/.*', 'path', 3600, 300, 70, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.cache_rules IS 'Dynamic cache configuration rules for CDN Worker';
COMMENT ON TABLE public.cache_stats IS 'Cache hit/miss metrics and performance statistics';
COMMENT ON TABLE public.cache_invalidations IS 'Audit trail of cache purge operations';
COMMENT ON COLUMN public.cache_rules.match_pattern IS 'Regex pattern for URL matching';
COMMENT ON COLUMN public.cache_rules.ttl IS 'Time to live in seconds';
COMMENT ON COLUMN public.cache_rules.stale_while_revalidate IS 'Serve stale while revalidating in background (seconds)';
COMMENT ON FUNCTION public.get_cache_coverage_summary() IS 'Returns 24h cache performance summary';