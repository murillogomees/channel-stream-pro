-- Tabela para histórico de métricas de observabilidade
CREATE TABLE public.observability_metrics_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  tags JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_observability_metrics_type ON public.observability_metrics_history(metric_type);
CREATE INDEX idx_observability_metrics_recorded_at ON public.observability_metrics_history(recorded_at DESC);
CREATE INDEX idx_observability_metrics_name_time ON public.observability_metrics_history(metric_name, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.observability_metrics_history ENABLE ROW LEVEL SECURITY;

-- Política para admins/masters lerem métricas
CREATE POLICY "Admins can read metrics history"
ON public.observability_metrics_history
FOR SELECT
USING (public.is_admin_or_master(auth.uid()));

-- Política para inserção via service role (edge functions)
CREATE POLICY "Service role can insert metrics"
ON public.observability_metrics_history
FOR INSERT
WITH CHECK (true);

-- Enable realtime para updates em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.observability_metrics_history;

-- Função para limpar métricas antigas (mais de 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_observability_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.observability_metrics_history
  WHERE recorded_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;