-- ================================================================
-- VOD DOWNLOAD SYSTEM - DATABASE SETUP
-- ================================================================

-- ==================== STEP 1: Adicionar campos em m3u_channels ====================
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS is_vod BOOLEAN DEFAULT false;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS r2_uploaded BOOLEAN DEFAULT false;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS r2_url TEXT;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS r2_uploaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'unknown';

COMMENT ON COLUMN m3u_channels.is_vod IS 'Indica se o canal é VOD (Video on Demand) e deve ser baixado para R2';
COMMENT ON COLUMN m3u_channels.r2_uploaded IS 'Indica se o VOD já foi feito upload para R2 CDN';
COMMENT ON COLUMN m3u_channels.r2_url IS 'URL do arquivo no R2 CDN (usado quando r2_uploaded = true)';
COMMENT ON COLUMN m3u_channels.r2_uploaded_at IS 'Data/hora do último upload para R2';
COMMENT ON COLUMN m3u_channels.content_type IS 'Tipo de conteúdo: live (ao vivo), vod (sob demanda), unknown (não identificado)';

-- ==================== STEP 2: Criar tabela vod_downloads ====================
CREATE TABLE IF NOT EXISTS vod_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES m3u_channels(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  r2_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  file_size_bytes BIGINT,
  segment_count INTEGER DEFAULT 0,
  segments_downloaded INTEGER DEFAULT 0,
  download_started_at TIMESTAMP WITH TIME ZONE,
  download_completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE vod_downloads IS 'Rastreia o progresso de download de VOD para Cloudflare R2';

-- ==================== STEP 3: Criar índices para performance ====================
CREATE INDEX IF NOT EXISTS idx_vod_downloads_channel ON vod_downloads(channel_id);
CREATE INDEX IF NOT EXISTS idx_vod_downloads_status ON vod_downloads(status);
CREATE INDEX IF NOT EXISTS idx_vod_downloads_created_at ON vod_downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_is_vod ON m3u_channels(is_vod) WHERE is_vod = true;
CREATE INDEX IF NOT EXISTS idx_m3u_channels_r2_uploaded ON m3u_channels(r2_uploaded) WHERE r2_uploaded = true;
CREATE INDEX IF NOT EXISTS idx_m3u_channels_content_type ON m3u_channels(content_type);

-- ==================== STEP 4: Trigger para atualizar updated_at ====================
CREATE OR REPLACE FUNCTION update_vod_downloads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vod_downloads_updated_at ON vod_downloads;
CREATE TRIGGER trigger_update_vod_downloads_updated_at
  BEFORE UPDATE ON vod_downloads
  FOR EACH ROW
  EXECUTE FUNCTION update_vod_downloads_updated_at();

-- ==================== STEP 5: RLS Policies ====================
ALTER TABLE vod_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access vod_downloads" ON vod_downloads;
CREATE POLICY "Admins full access vod_downloads" 
  ON vod_downloads 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ==================== STEP 6: Função para limpar downloads antigos ====================
CREATE OR REPLACE FUNCTION cleanup_old_vod_downloads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM vod_downloads
  WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '7 days';
    
  DELETE FROM vod_downloads
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- ==================== STEP 7: Função para obter estatísticas de VOD ====================
CREATE OR REPLACE FUNCTION get_vod_statistics()
RETURNS TABLE(
  total_vods BIGINT,
  vods_uploaded BIGINT,
  vods_pending BIGINT,
  downloads_in_progress BIGINT,
  downloads_failed BIGINT,
  total_storage_bytes BIGINT,
  avg_file_size_mb NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE is_vod = true)::BIGINT as total_vods,
    COUNT(*) FILTER (WHERE r2_uploaded = true)::BIGINT as vods_uploaded,
    COUNT(*) FILTER (WHERE is_vod = true AND r2_uploaded = false)::BIGINT as vods_pending,
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status IN ('downloading', 'processing')) as downloads_in_progress,
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status = 'failed') as downloads_failed,
    COALESCE(SUM(COALESCE((SELECT file_size_bytes FROM vod_downloads WHERE channel_id = m3u_channels.id AND status = 'completed' LIMIT 1), 0)), 0)::BIGINT as total_storage_bytes,
    ROUND(COALESCE(AVG(COALESCE((SELECT file_size_bytes FROM vod_downloads WHERE channel_id = m3u_channels.id AND status = 'completed' LIMIT 1), 0)), 0) / 1048576.0, 2) as avg_file_size_mb
  FROM m3u_channels;
END;
$$;

-- ==================== STEP 8: Função para detectar e marcar VODs automaticamente ====================
CREATE OR REPLACE FUNCTION detect_vod_channels()
RETURNS TABLE(
  updated_count BIGINT,
  vod_count BIGINT,
  live_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated BIGINT := 0;
  v_vod BIGINT := 0;
  v_live BIGINT := 0;
BEGIN
  -- Detectar VOD baseado em padrões de categoria e nome
  UPDATE m3u_channels
  SET 
    is_vod = true,
    content_type = 'vod'
  WHERE (
    -- Padrões de filmes
    LOWER(group_title) LIKE '%filme%'
    OR LOWER(group_title) LIKE '%movie%'
    OR LOWER(group_title) LIKE '%cinema%'
    OR LOWER(group_title) LIKE '%vod%'
    -- Padrões de séries
    OR LOWER(group_title) LIKE '%serie%'
    OR LOWER(group_title) LIKE '%series%'
    OR LOWER(group_title) LIKE '%temporada%'
    OR LOWER(group_title) LIKE '%season%'
    -- Padrões em URLs
    OR LOWER(stream_url) LIKE '%/movie/%'
    OR LOWER(stream_url) LIKE '%/series/%'
    OR LOWER(stream_url) LIKE '%/vod/%'
  )
  AND is_vod = false;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Marcar explicitamente como live os canais com padrões de live
  UPDATE m3u_channels
  SET content_type = 'live'
  WHERE (
    LOWER(group_title) LIKE '%live%'
    OR LOWER(group_title) LIKE '%ao vivo%'
    OR LOWER(group_title) LIKE '%tv%'
    OR LOWER(stream_url) LIKE '%/live/%'
    OR LOWER(stream_url) LIKE '%.m3u8%'
  )
  AND content_type = 'unknown'
  AND is_vod = false;
  
  -- Contar resultados
  SELECT COUNT(*) INTO v_vod FROM m3u_channels WHERE is_vod = true;
  SELECT COUNT(*) INTO v_live FROM m3u_channels WHERE content_type = 'live';
  
  RETURN QUERY SELECT v_updated, v_vod, v_live;
END;
$$;

COMMENT ON FUNCTION detect_vod_channels IS 'Detecta e marca automaticamente canais como VOD baseado em padrões de categoria e URL';