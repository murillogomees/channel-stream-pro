
-- ============================================
-- R2 SCHEDULER SYSTEM - Complemento ao sistema existente
-- ============================================

-- Tabela de estatísticas de demanda por canal
CREATE TABLE IF NOT EXISTS public.channel_demand_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  views_1h INTEGER DEFAULT 0,
  views_24h INTEGER DEFAULT 0,
  views_7d INTEGER DEFAULT 0,
  views_30d INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  watch_time_seconds_24h BIGINT DEFAULT 0,
  watch_time_seconds_7d BIGINT DEFAULT 0,
  avg_watch_duration_seconds INTEGER DEFAULT 0,
  demand_score NUMERIC(10,2) DEFAULT 0,
  trending_score NUMERIC(10,2) DEFAULT 0,
  peak_hours INTEGER[] DEFAULT '{}',
  last_peak_at TIMESTAMP WITH TIME ZONE,
  concurrent_viewers_current INTEGER DEFAULT 0,
  concurrent_viewers_max_24h INTEGER DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_channel_demand UNIQUE(channel_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_demand_score ON channel_demand_stats(demand_score DESC);

-- Tabela de jobs do scheduler R2 (similar ao cf_stream_uploads)
CREATE TABLE IF NOT EXISTS public.r2_download_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'validating', 'downloading', 'uploading', 'processing', 'completed', 'failed', 'paused', 'retry_scheduled', 'cancelled')),
  original_url TEXT NOT NULL,
  r2_key TEXT,
  r2_url TEXT,
  progress_percent INTEGER DEFAULT 0,
  downloaded_bytes BIGINT DEFAULT 0,
  total_bytes BIGINT,
  parts_uploaded INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  error_category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_r2_jobs_status ON r2_download_jobs(status);
CREATE INDEX IF NOT EXISTS idx_r2_jobs_channel ON r2_download_jobs(channel_id);
CREATE INDEX IF NOT EXISTS idx_r2_jobs_retry ON r2_download_jobs(next_retry_at) WHERE status = 'retry_scheduled';

-- Configuração de priorização de conteúdo
CREATE TABLE IF NOT EXISTS public.content_routing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir configurações padrão de roteamento
INSERT INTO content_routing_config (config_key, config_value, description) VALUES
('live_tv_patterns', '{"category_patterns": ["(?i)(ao.?vivo|live|tv|canal|channel|news|esporte|sport|futebol|football|24.?horas|24h)"], "default_destination": "stream", "priority": 10}', 'Padrões para TV ao vivo - prioriza Stream'),
('series_patterns', '{"category_patterns": ["(?i)(série|series|temporada|season|episódio|episode|s\\d+e\\d+|\\dx\\d+)"], "name_patterns": ["S\\d{1,2}E\\d{1,3}", "\\d{1,2}x\\d{1,3}"], "default_destination": "r2", "priority": 20}', 'Padrões para séries - prioriza R2'),
('movies_patterns', '{"category_patterns": ["(?i)(filme|movie|cinema|filmes|movies|dublado|legendado)"], "default_destination": "r2", "priority": 25}', 'Padrões para filmes - prioriza R2'),
('anime_patterns', '{"category_patterns": ["(?i)(anime|animação|cartoon|dorama|doramas)"], "default_destination": "r2", "priority": 30}', 'Padrões para anime/animação - prioriza R2'),
('catalog_default', '{"default_destination": "stream", "priority": 100, "views_threshold_for_r2": 10}', 'Configuração padrão para catálogo - Stream por padrão, R2 se alta demanda'),
('demand_thresholds', '{"high_demand_views_24h": 10, "promote_to_r2_score": 50, "demote_from_cdn_days": 30}', 'Thresholds para promoção automática baseada em demanda')
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS
ALTER TABLE channel_demand_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_download_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_routing_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins manage channel_demand_stats" ON channel_demand_stats FOR ALL USING (true);
CREATE POLICY "Admins manage r2_download_jobs" ON r2_download_jobs FOR ALL USING (true);
CREATE POLICY "Admins manage content_routing_config" ON content_routing_config FOR ALL USING (true);

-- ============================================
-- FUNÇÕES DE ROTEAMENTO INTELIGENTE
-- ============================================

-- Função para determinar destino de um canal
CREATE OR REPLACE FUNCTION determine_content_destination(p_channel_id UUID)
RETURNS TABLE(
  destination TEXT,
  reason TEXT,
  resolved_url TEXT,
  fallback_url TEXT,
  should_download BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel RECORD;
  v_demand RECORD;
  v_config RECORD;
  v_destination TEXT := 'origin';
  v_reason TEXT := 'Default';
  v_should_download BOOLEAN := false;
BEGIN
  SELECT * INTO v_channel FROM m3u_channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'origin'::TEXT, 'Channel not found'::TEXT, NULL::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  
  SELECT * INTO v_demand FROM channel_demand_stats WHERE channel_id = p_channel_id;
  
  -- Se já tem R2, usar R2
  IF v_channel.r2_uploaded AND v_channel.r2_url IS NOT NULL THEN
    RETURN QUERY SELECT 'r2'::TEXT, 'Already in R2'::TEXT, v_channel.r2_url, v_channel.stream_url, false;
    RETURN;
  END IF;
  
  -- Se já tem Stream ready, usar Stream
  IF v_channel.cf_stream_status = 'ready' AND v_channel.cf_stream_url IS NOT NULL THEN
    RETURN QUERY SELECT 'stream'::TEXT, 'Already in Stream'::TEXT, v_channel.cf_stream_url, v_channel.stream_url, false;
    RETURN;
  END IF;
  
  -- Verificar padrões de live TV
  SELECT config_value INTO v_config FROM content_routing_config WHERE config_key = 'live_tv_patterns';
  IF v_config IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_config.config_value->'category_patterns') pattern 
      WHERE COALESCE(v_channel.group_title, '') ~* pattern 
         OR COALESCE(v_channel.name, '') ~* pattern
    ) THEN
      RETURN QUERY SELECT 'stream'::TEXT, 'Live TV pattern matched - prioritize Stream'::TEXT, v_channel.stream_url, v_channel.stream_url, true;
      RETURN;
    END IF;
  END IF;
  
  -- Verificar padrões de séries
  SELECT config_value INTO v_config FROM content_routing_config WHERE config_key = 'series_patterns';
  IF v_config IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_config.config_value->'category_patterns') pattern 
      WHERE COALESCE(v_channel.group_title, '') ~* pattern
    ) OR v_channel.name ~* 'S\d{1,2}E\d{1,3}' OR v_channel.name ~* '\d{1,2}x\d{1,3}' THEN
      RETURN QUERY SELECT 'r2'::TEXT, 'Series pattern matched - prioritize R2'::TEXT, v_channel.stream_url, v_channel.stream_url, true;
      RETURN;
    END IF;
  END IF;
  
  -- Verificar padrões de filmes
  SELECT config_value INTO v_config FROM content_routing_config WHERE config_key = 'movies_patterns';
  IF v_config IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_config.config_value->'category_patterns') pattern 
      WHERE COALESCE(v_channel.group_title, '') ~* pattern
    ) THEN
      RETURN QUERY SELECT 'r2'::TEXT, 'Movie pattern matched - prioritize R2'::TEXT, v_channel.stream_url, v_channel.stream_url, true;
      RETURN;
    END IF;
  END IF;
  
  -- Verificar alta demanda para promoção
  IF v_demand IS NOT NULL AND v_demand.views_24h >= 10 THEN
    RETURN QUERY SELECT 'r2'::TEXT, 'High demand detected - should download to R2'::TEXT, v_channel.stream_url, v_channel.stream_url, true;
    RETURN;
  END IF;
  
  -- Default: Stream para catálogo geral
  RETURN QUERY SELECT 'stream'::TEXT, 'Catalog default - Stream'::TEXT, v_channel.stream_url, v_channel.stream_url, v_channel.is_vod;
END;
$$;

-- Função para obter candidatos R2
CREATE OR REPLACE FUNCTION get_r2_download_candidates(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  channel_id UUID,
  channel_name TEXT,
  stream_url TEXT,
  group_title TEXT,
  demand_score NUMERIC,
  views_24h INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.stream_url,
    c.group_title,
    COALESCE(d.demand_score, 0),
    COALESCE(d.views_24h, 0),
    CASE 
      WHEN c.group_title ~* '(série|series|temporada|season|episódio|episode)' THEN 'Series pattern'
      WHEN c.name ~* 'S\d{1,2}E\d{1,3}' THEN 'Episode pattern'
      WHEN c.group_title ~* '(filme|movie|cinema)' THEN 'Movie pattern'
      WHEN COALESCE(d.views_24h, 0) >= 10 THEN 'High demand'
      ELSE 'VOD candidate'
    END
  FROM m3u_channels c
  LEFT JOIN channel_demand_stats d ON d.channel_id = c.id
  WHERE c.is_vod = true
    AND c.r2_uploaded = false
    AND (c.cf_stream_status IS NULL OR c.cf_stream_status NOT IN ('ready', 'processing'))
    AND NOT EXISTS (
      SELECT 1 FROM r2_download_jobs j 
      WHERE j.channel_id = c.id AND j.status IN ('queued', 'downloading', 'uploading', 'processing')
    )
    AND NOT EXISTS (
      SELECT 1 FROM vod_downloads v 
      WHERE v.channel_id = c.id AND v.status IN ('queued', 'downloading', 'processing')
    )
    AND (
      c.group_title ~* '(série|series|filme|movie|novela|dorama|anime|temporada|season)'
      OR c.name ~* 'S\d{1,2}E\d{1,3}'
      OR c.name ~* '\d{1,2}x\d{1,3}'
      OR COALESCE(d.views_24h, 0) >= 10
    )
  ORDER BY 
    CASE WHEN COALESCE(d.views_24h, 0) >= 10 THEN 0 ELSE 1 END,
    COALESCE(d.demand_score, 0) DESC
  LIMIT p_limit;
END;
$$;

-- Função para obter candidatos Stream
CREATE OR REPLACE FUNCTION get_stream_upload_candidates(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  channel_id UUID,
  channel_name TEXT,
  stream_url TEXT,
  group_title TEXT,
  demand_score NUMERIC,
  views_24h INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.stream_url,
    c.group_title,
    COALESCE(d.demand_score, 0),
    COALESCE(d.views_24h, 0),
    CASE 
      WHEN c.group_title ~* '(ao.?vivo|live|tv|canal|channel|news|esporte)' THEN 'Live TV pattern'
      WHEN c.is_vod = false THEN 'Non-VOD'
      ELSE 'Catalog default'
    END
  FROM m3u_channels c
  LEFT JOIN channel_demand_stats d ON d.channel_id = c.id
  WHERE c.is_vod = true
    AND (c.cf_stream_status IS NULL OR c.cf_stream_status NOT IN ('ready', 'processing', 'uploading'))
    AND c.r2_uploaded = false
    AND NOT EXISTS (
      SELECT 1 FROM cf_stream_uploads u 
      WHERE u.channel_id = c.id AND u.status IN ('queued', 'uploading', 'processing')
    )
    AND NOT (
      c.group_title ~* '(série|series|filme|movie|novela|dorama|anime|temporada|season)'
      OR c.name ~* 'S\d{1,2}E\d{1,3}'
    )
  ORDER BY COALESCE(d.demand_score, 0) DESC
  LIMIT p_limit;
END;
$$;

-- Função para estatísticas do sistema de roteamento
CREATE OR REPLACE FUNCTION get_content_routing_stats()
RETURNS TABLE(
  total_vods BIGINT,
  in_r2 BIGINT,
  in_stream BIGINT,
  origin_only BIGINT,
  r2_jobs_queued BIGINT,
  r2_jobs_processing BIGINT,
  r2_jobs_completed BIGINT,
  r2_jobs_failed BIGINT,
  stream_jobs_queued BIGINT,
  stream_jobs_processing BIGINT,
  stream_jobs_ready BIGINT,
  high_demand_channels BIGINT,
  series_count BIGINT,
  movies_count BIGINT,
  live_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM m3u_channels WHERE is_vod = true),
    (SELECT COUNT(*) FROM m3u_channels WHERE r2_uploaded = true),
    (SELECT COUNT(*) FROM m3u_channels WHERE cf_stream_status = 'ready'),
    (SELECT COUNT(*) FROM m3u_channels WHERE is_vod = true AND r2_uploaded = false AND (cf_stream_status IS NULL OR cf_stream_status != 'ready')),
    (SELECT COUNT(*) FROM r2_download_jobs WHERE status = 'queued'),
    (SELECT COUNT(*) FROM r2_download_jobs WHERE status IN ('downloading', 'uploading', 'processing')),
    (SELECT COUNT(*) FROM r2_download_jobs WHERE status = 'completed'),
    (SELECT COUNT(*) FROM r2_download_jobs WHERE status = 'failed'),
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'queued'),
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status IN ('uploading', 'processing')),
    (SELECT COUNT(*) FROM cf_stream_uploads WHERE status = 'ready'),
    (SELECT COUNT(*) FROM channel_demand_stats WHERE demand_score > 10),
    (SELECT COUNT(*) FROM m3u_channels WHERE group_title ~* '(série|series|temporada|season)' OR name ~* 'S\d{1,2}E\d{1,3}'),
    (SELECT COUNT(*) FROM m3u_channels WHERE group_title ~* '(filme|movie|cinema)'),
    (SELECT COUNT(*) FROM m3u_channels WHERE group_title ~* '(ao.?vivo|live|tv|canal|channel)' AND is_vod = false);
END;
$$;

-- Função para atualizar demanda
CREATE OR REPLACE FUNCTION track_channel_view(p_channel_id UUID, p_watch_seconds INTEGER DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO channel_demand_stats (channel_id, views_1h, views_24h, views_7d, views_30d, total_views, watch_time_seconds_24h)
  VALUES (p_channel_id, 1, 1, 1, 1, 1, p_watch_seconds)
  ON CONFLICT (channel_id) DO UPDATE SET
    views_1h = channel_demand_stats.views_1h + 1,
    views_24h = channel_demand_stats.views_24h + 1,
    views_7d = channel_demand_stats.views_7d + 1,
    views_30d = channel_demand_stats.views_30d + 1,
    total_views = channel_demand_stats.total_views + 1,
    watch_time_seconds_24h = channel_demand_stats.watch_time_seconds_24h + p_watch_seconds,
    calculated_at = now();
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_r2_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_r2_download_jobs_updated_at
  BEFORE UPDATE ON r2_download_jobs
  FOR EACH ROW EXECUTE FUNCTION update_r2_jobs_updated_at();
