-- Adicionar colunas faltantes em metrics_snapshots
ALTER TABLE public.metrics_snapshots 
ADD COLUMN IF NOT EXISTS current_connection_attempt integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_connection_time numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_connection_time numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_uptime bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_downtime bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS reconnection_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_time_between_reconnections numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_uptime_period bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_latency numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_latency numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS latency_history numeric[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_events_sent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_events_received integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS fallback_mode_activations integer DEFAULT 0;

-- Adicionar colunas faltantes em health_snapshots
ALTER TABLE public.health_snapshots 
ADD COLUMN IF NOT EXISTS websocket_error text,
ADD COLUMN IF NOT EXISTS supabase_error text,
ADD COLUMN IF NOT EXISTS whatsapp_error text,
ADD COLUMN IF NOT EXISTS smartone_error text;