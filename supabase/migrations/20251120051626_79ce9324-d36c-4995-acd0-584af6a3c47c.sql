-- =====================================================
-- SISTEMA AVANÇADO DE IMPORTAÇÃO M3U
-- Suporta arquivos grandes (100MB+) com processamento assíncrono
-- =====================================================

-- Tabela para rastrear sessões de importação
CREATE TABLE IF NOT EXISTS public.m3u_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_list_id UUID REFERENCES public.m3u_custom_lists(id) ON DELETE CASCADE,
  total_channels INTEGER DEFAULT 0,
  processed_channels INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused')),
  error_message TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'paste')),
  source_url TEXT,
  source_hash TEXT,
  batch_size INTEGER DEFAULT 1000,
  current_batch INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ
);

-- Tabela de cache para M3U importados
CREATE TABLE IF NOT EXISTS public.m3u_import_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash TEXT UNIQUE NOT NULL,
  source_url TEXT,
  channel_count INTEGER NOT NULL,
  categories_data JSONB NOT NULL,
  channels_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  use_count INTEGER DEFAULT 1
);

-- Tabela de fila para gerenciar imports
CREATE TABLE IF NOT EXISTS public.m3u_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.m3u_import_sessions(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_m3u_import_sessions_status ON public.m3u_import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_m3u_import_sessions_custom_list ON public.m3u_import_sessions(custom_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_import_sessions_created_by ON public.m3u_import_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_m3u_import_cache_hash ON public.m3u_import_cache(source_hash);
CREATE INDEX IF NOT EXISTS idx_m3u_import_cache_last_used ON public.m3u_import_cache(last_used_at);
CREATE INDEX IF NOT EXISTS idx_m3u_import_queue_status ON public.m3u_import_queue(status);
CREATE INDEX IF NOT EXISTS idx_m3u_import_queue_priority ON public.m3u_import_queue(priority DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_m3u_import_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_m3u_import_session_updated_at ON public.m3u_import_sessions;
CREATE TRIGGER trigger_update_m3u_import_session_updated_at
  BEFORE UPDATE ON public.m3u_import_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_m3u_import_session_updated_at();

-- RLS Policies
ALTER TABLE public.m3u_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_import_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_import_queue ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total
CREATE POLICY "Admins têm acesso total a import sessions"
  ON public.m3u_import_sessions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins têm acesso total a import cache"
  ON public.m3u_import_cache
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins têm acesso total a import queue"
  ON public.m3u_import_queue
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Função para limpar cache antigo (30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_import_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.m3u_import_cache
  WHERE last_used_at < now() - interval '30 days';
END;
$$;

-- Função para obter estatísticas de importação
CREATE OR REPLACE FUNCTION get_import_statistics()
RETURNS TABLE(
  total_imports BIGINT,
  pending_imports BIGINT,
  processing_imports BIGINT,
  completed_imports BIGINT,
  failed_imports BIGINT,
  cache_hits BIGINT,
  avg_channels_per_import NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*)::BIGINT as total_imports,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_imports,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT as processing_imports,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_imports,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_imports,
    (SELECT COUNT(*)::BIGINT FROM public.m3u_import_cache WHERE use_count > 1) as cache_hits,
    ROUND(AVG(total_channels), 2) as avg_channels_per_import
  FROM public.m3u_import_sessions;
$$;