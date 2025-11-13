-- ============================================
-- METRICS PERSISTENCE - DATABASE SETUP
-- ============================================
-- Execute este SQL manualmente no Supabase SQL Editor
-- quando a conexão estabilizar

-- Create table for metrics snapshots
CREATE TABLE IF NOT EXISTS public.metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics_type TEXT NOT NULL DEFAULT 'websocket',
  
  -- Connection metrics
  total_connections INTEGER NOT NULL DEFAULT 0,
  successful_connections INTEGER NOT NULL DEFAULT 0,
  failed_connections INTEGER NOT NULL DEFAULT 0,
  current_connection_attempt INTEGER NOT NULL DEFAULT 0,
  
  -- Timing metrics
  average_connection_time NUMERIC NOT NULL DEFAULT 0,
  last_connection_time NUMERIC NOT NULL DEFAULT 0,
  total_uptime BIGINT NOT NULL DEFAULT 0,
  total_downtime BIGINT NOT NULL DEFAULT 0,
  
  -- Reconnection metrics
  total_reconnections INTEGER NOT NULL DEFAULT 0,
  reconnection_rate NUMERIC NOT NULL DEFAULT 0,
  average_time_between_reconnections NUMERIC NOT NULL DEFAULT 0,
  longest_uptime_period BIGINT NOT NULL DEFAULT 0,
  
  -- Latency metrics
  average_latency NUMERIC NOT NULL DEFAULT 0,
  min_latency NUMERIC NOT NULL DEFAULT 0,
  max_latency NUMERIC NOT NULL DEFAULT 0,
  latency_history JSONB DEFAULT '[]'::jsonb,
  
  -- Event metrics
  total_events_sent INTEGER NOT NULL DEFAULT 0,
  total_events_received INTEGER NOT NULL DEFAULT 0,
  failed_events INTEGER NOT NULL DEFAULT 0,
  
  -- Health status
  current_status TEXT NOT NULL DEFAULT 'offline',
  fallback_mode_activations INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_timestamp ON public.metrics_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_metrics_type ON public.metrics_snapshots(metrics_type);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_created_at ON public.metrics_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_status ON public.metrics_snapshots(current_status);

-- Enable Row Level Security
ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view metrics snapshots" ON public.metrics_snapshots;
DROP POLICY IF EXISTS "System can insert metrics snapshots" ON public.metrics_snapshots;

-- Create policies for read/write access
CREATE POLICY "Authenticated users can view metrics"
  ON public.metrics_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert metrics"
  ON public.metrics_snapshots
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create table for system health snapshots
CREATE TABLE IF NOT EXISTS public.health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  overall_status TEXT NOT NULL,
  
  -- WebSocket service
  websocket_status TEXT NOT NULL DEFAULT 'unknown',
  websocket_latency NUMERIC,
  websocket_error TEXT,
  
  -- Supabase service
  supabase_status TEXT NOT NULL DEFAULT 'unknown',
  supabase_latency NUMERIC,
  supabase_error TEXT,
  
  -- WhatsApp service
  whatsapp_status TEXT NOT NULL DEFAULT 'unknown',
  whatsapp_latency NUMERIC,
  whatsapp_error TEXT,
  
  -- SmartOne service
  smartone_status TEXT NOT NULL DEFAULT 'unknown',
  smartone_latency NUMERIC,
  smartone_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp ON public.health_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_overall_status ON public.health_snapshots(overall_status);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_created_at ON public.health_snapshots(created_at DESC);

-- Enable RLS
ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view health snapshots" ON public.health_snapshots;
DROP POLICY IF EXISTS "System can insert health snapshots" ON public.health_snapshots;

-- Create policies
CREATE POLICY "Authenticated users can view health"
  ON public.health_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert health"
  ON public.health_snapshots
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Function to clean old snapshots (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.metrics_snapshots
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM public.health_snapshots
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to get metrics for a time period
CREATE OR REPLACE FUNCTION public.get_metrics_for_period(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  metrics_type_filter TEXT DEFAULT 'websocket'
)
RETURNS TABLE (
  snapshot_timestamp TIMESTAMPTZ,
  avg_latency NUMERIC,
  uptime BIGINT,
  downtime BIGINT,
  success_rate NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    timestamp as snapshot_timestamp,
    average_latency as avg_latency,
    total_uptime as uptime,
    total_downtime as downtime,
    CASE 
      WHEN total_connections > 0 
      THEN (successful_connections::NUMERIC / total_connections::NUMERIC * 100)
      ELSE 0 
    END as success_rate,
    current_status as status
  FROM public.metrics_snapshots
  WHERE timestamp BETWEEN start_time AND end_time
    AND metrics_type = metrics_type_filter
  ORDER BY timestamp ASC;
END;
$$;

-- Function to get aggregated metrics by hour
CREATE OR REPLACE FUNCTION public.get_hourly_metrics(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
RETURNS TABLE (
  hour TIMESTAMPTZ,
  avg_latency NUMERIC,
  max_latency NUMERIC,
  min_latency NUMERIC,
  total_connections_count INTEGER,
  successful_connections_count INTEGER,
  avg_uptime BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('hour', timestamp) as hour,
    AVG(average_latency) as avg_latency,
    MAX(max_latency) as max_latency,
    MIN(min_latency) as min_latency,
    MAX(total_connections) as total_connections_count,
    MAX(successful_connections) as successful_connections_count,
    AVG(total_uptime)::BIGINT as avg_uptime
  FROM public.metrics_snapshots
  WHERE timestamp BETWEEN start_time AND end_time
  GROUP BY date_trunc('hour', timestamp)
  ORDER BY hour ASC;
END;
$$;

-- Function to compare two time periods
CREATE OR REPLACE FUNCTION public.compare_periods(
  period1_start TIMESTAMPTZ,
  period1_end TIMESTAMPTZ,
  period2_start TIMESTAMPTZ,
  period2_end TIMESTAMPTZ
)
RETURNS TABLE (
  metric_name TEXT,
  period1_value NUMERIC,
  period2_value NUMERIC,
  change_percent NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p1_avg_latency NUMERIC;
  p2_avg_latency NUMERIC;
  p1_uptime BIGINT;
  p2_uptime BIGINT;
  p1_success_rate NUMERIC;
  p2_success_rate NUMERIC;
BEGIN
  -- Calculate period 1 metrics
  SELECT 
    AVG(average_latency),
    AVG(total_uptime),
    AVG(CASE WHEN total_connections > 0 THEN (successful_connections::NUMERIC / total_connections::NUMERIC * 100) ELSE 0 END)
  INTO p1_avg_latency, p1_uptime, p1_success_rate
  FROM public.metrics_snapshots
  WHERE timestamp BETWEEN period1_start AND period1_end;
  
  -- Calculate period 2 metrics
  SELECT 
    AVG(average_latency),
    AVG(total_uptime),
    AVG(CASE WHEN total_connections > 0 THEN (successful_connections::NUMERIC / total_connections::NUMERIC * 100) ELSE 0 END)
  INTO p2_avg_latency, p2_uptime, p2_success_rate
  FROM public.metrics_snapshots
  WHERE timestamp BETWEEN period2_start AND period2_end;
  
  -- Return comparison
  RETURN QUERY
  SELECT 'Latência Média (ms)'::TEXT, 
    COALESCE(p1_avg_latency, 0), 
    COALESCE(p2_avg_latency, 0), 
    CASE WHEN COALESCE(p1_avg_latency, 0) > 0 
      THEN ((COALESCE(p2_avg_latency, 0) - COALESCE(p1_avg_latency, 0)) / COALESCE(p1_avg_latency, 1) * 100) 
      ELSE 0 
    END
  UNION ALL
  SELECT 'Uptime (ms)'::TEXT, 
    COALESCE(p1_uptime, 0), 
    COALESCE(p2_uptime, 0),
    CASE WHEN COALESCE(p1_uptime, 0) > 0 
      THEN ((COALESCE(p2_uptime, 0) - COALESCE(p1_uptime, 0))::NUMERIC / COALESCE(p1_uptime, 1)::NUMERIC * 100) 
      ELSE 0 
    END
  UNION ALL
  SELECT 'Taxa de Sucesso (%)'::TEXT, 
    COALESCE(p1_success_rate, 0), 
    COALESCE(p2_success_rate, 0),
    CASE WHEN COALESCE(p1_success_rate, 0) > 0 
      THEN ((COALESCE(p2_success_rate, 0) - COALESCE(p1_success_rate, 0)) / COALESCE(p1_success_rate, 1) * 100) 
      ELSE 0 
    END;
END;
$$;