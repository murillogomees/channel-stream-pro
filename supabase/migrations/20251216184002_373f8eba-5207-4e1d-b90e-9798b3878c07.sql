-- ============================================================================
-- OTIMIZAÇÃO COMPLETA: Cron + Particionamento + Índices Adicionais
-- ============================================================================

-- 1. CRON: Refresh automático das materialized views a cada 5 minutos
SELECT cron.schedule(
  'refresh-materialized-views',
  '*/5 * * * *',
  $$SELECT refresh_all_materialized_views()$$
);

-- 2. PARTICIONAMENTO: Converter activity_logs para tabela particionada por mês
-- Primeiro, criar a nova tabela particionada
CREATE TABLE IF NOT EXISTS public.activity_logs_partitioned (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Criar partições para os próximos 12 meses
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_01 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_02 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_03 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_04 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_05 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_06 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_07 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_08 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_09 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_10 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_11 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_12 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Partições para 2026
CREATE TABLE IF NOT EXISTS public.activity_logs_2026_01 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2026_02 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.activity_logs_2026_03 PARTITION OF public.activity_logs_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 3. RLS na tabela particionada
ALTER TABLE public.activity_logs_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity partitioned" 
ON public.activity_logs_partitioned 
FOR SELECT 
USING (is_admin_or_master());

CREATE POLICY "Anyone can insert activity partitioned" 
ON public.activity_logs_partitioned 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view own activity partitioned" 
ON public.activity_logs_partitioned 
FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Índices otimizados na tabela particionada
CREATE INDEX IF NOT EXISTS idx_activity_logs_part_user_created 
ON public.activity_logs_partitioned (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_part_action 
ON public.activity_logs_partitioned (action, created_at DESC);

-- 5. Função para criar partições automaticamente
CREATE OR REPLACE FUNCTION public.create_activity_logs_partition()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Criar partição para o próximo mês
  v_start_date := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
  v_end_date := v_start_date + INTERVAL '1 month';
  v_partition_name := 'activity_logs_' || TO_CHAR(v_start_date, 'YYYY_MM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = v_partition_name AND schemaname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.activity_logs_partitioned FOR VALUES FROM (%L) TO (%L)',
      v_partition_name, v_start_date, v_end_date
    );
    RAISE NOTICE 'Created partition: %', v_partition_name;
  END IF;
END;
$$;

-- 6. Cron para criar partições automaticamente (1x por mês)
SELECT cron.schedule(
  'create-activity-logs-partition',
  '0 0 1 * *',
  $$SELECT create_activity_logs_partition()$$
);

-- 7. View para acesso transparente (usa particionada se existir dados, senão usa original)
CREATE OR REPLACE VIEW public.v_activity_logs AS
SELECT * FROM public.activity_logs
UNION ALL
SELECT id, user_id, action, entity_type, entity_id, details, ip_address, created_at 
FROM public.activity_logs_partitioned;

-- 8. Função otimizada para buscar atividades recentes
CREATE OR REPLACE FUNCTION public.get_recent_activities(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at
  FROM public.activity_logs al
  WHERE al.created_at > NOW() - (p_days || ' days')::INTERVAL
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_activities TO authenticated;

-- 9. Função para limpar dados antigos (manter apenas últimos 90 dias na tabela principal)
CREATE OR REPLACE FUNCTION public.archive_old_activity_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived INTEGER;
BEGIN
  -- Mover dados antigos para tabela particionada
  WITH moved AS (
    DELETE FROM public.activity_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  INSERT INTO public.activity_logs_partitioned 
  SELECT id, user_id, action, entity_type, entity_id, details, ip_address, created_at FROM moved;
  
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  RETURN v_archived;
END;
$$;

-- 10. Cron para arquivar logs antigos (1x por semana)
SELECT cron.schedule(
  'archive-old-activity-logs',
  '0 3 * * 0',
  $$SELECT archive_old_activity_logs()$$
);