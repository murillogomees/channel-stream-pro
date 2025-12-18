-- ============================================
-- VIEWS MATERIALIZADAS PARA ALTO VOLUME (55k+ canais)
-- ============================================

-- 1. CATEGORIAS COM CONTAGEM - Para navegação rápida
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_stats AS
SELECT 
  category,
  COUNT(*) as channel_count,
  COUNT(*) FILTER (WHERE is_healthy = true) as healthy_count,
  COUNT(*) FILTER (WHERE is_series = true) as series_count,
  COUNT(*) FILTER (WHERE content_type = 'live') as live_count,
  COUNT(*) FILTER (WHERE content_type IN ('vod', 'movie')) as vod_count,
  MIN(created_at) as first_added,
  MAX(updated_at) as last_updated
FROM iptv_channels
WHERE category IS NOT NULL
GROUP BY category
ORDER BY channel_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_stats_category ON mv_category_stats(category);

-- 2. SÉRIES AGREGADAS - Para navegação por série
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_series_catalog AS
SELECT 
  series_name,
  category,
  COUNT(*) as episode_count,
  MAX(season_number) as max_season,
  MAX(episode_number) as max_episode,
  MIN(logo_url) FILTER (WHERE logo_url IS NOT NULL) as logo_url,
  ARRAY_AGG(DISTINCT season_number ORDER BY season_number) as seasons,
  MIN(id) as first_episode_id
FROM iptv_channels
WHERE is_series = true AND series_name IS NOT NULL
GROUP BY series_name, category
HAVING COUNT(*) > 1
ORDER BY series_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_series_catalog_name ON mv_series_catalog(series_name, category);
CREATE INDEX IF NOT EXISTS idx_mv_series_catalog_category ON mv_series_catalog(category);

-- 3. CONTEÚDO RECENTE - Para "Adicionados Recentemente"
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_recent_content AS
SELECT 
  id,
  name,
  category,
  logo_url,
  content_type,
  is_series,
  series_name,
  created_at
FROM iptv_channels
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

CREATE INDEX IF NOT EXISTS idx_mv_recent_content_created ON mv_recent_content(created_at DESC);

-- 4. TOP CATEGORIAS POR TIPO - Para filtros rápidos
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_content_type_stats AS
SELECT 
  content_type,
  COUNT(*) as total,
  COUNT(DISTINCT category) as category_count,
  ARRAY_AGG(DISTINCT category ORDER BY category) FILTER (WHERE category IS NOT NULL) as categories
FROM iptv_channels
GROUP BY content_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_content_type_stats ON mv_content_type_stats(content_type);

-- 5. FUNÇÃO PARA REFRESH OTIMIZADO (apenas views críticas)
CREATE OR REPLACE FUNCTION refresh_browse_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_series_catalog;
  REFRESH MATERIALIZED VIEW mv_recent_content; -- Não tem unique index
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_content_type_stats;
END;
$$;

-- 6. ÍNDICES COMPOSTOS PARA QUERIES COMUNS
CREATE INDEX IF NOT EXISTS idx_iptv_channels_browse 
ON iptv_channels(category, content_type, is_healthy) 
WHERE is_healthy = true;

CREATE INDEX IF NOT EXISTS idx_iptv_channels_series_browse 
ON iptv_channels(series_name, season_number, episode_number) 
WHERE is_series = true;

-- 7. PARTIAL INDEX PARA LIVE CHANNELS (menor footprint)
CREATE INDEX IF NOT EXISTS idx_iptv_channels_live_only 
ON iptv_channels(category, name) 
WHERE content_type = 'live' AND is_healthy = true;

-- 8. PARTIAL INDEX PARA VOD (filmes/séries)
CREATE INDEX IF NOT EXISTS idx_iptv_channels_vod_only 
ON iptv_channels(category, series_name, name) 
WHERE content_type IN ('vod', 'movie', 'series') AND is_healthy = true;