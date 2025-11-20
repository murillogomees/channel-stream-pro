-- ================================================================
-- VOD DOWNLOAD SYSTEM - DATABASE SETUP
-- ================================================================
-- Este script adiciona suporte completo para download e hospedagem
-- de VOD (Video on Demand) no Cloudflare R2 CDN
-- ================================================================

-- ==================== STEP 1: Adicionar campos em m3u_channels ====================
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS is_vod BOOLEAN DEFAULT false;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS r2_uploaded BOOLEAN DEFAULT false;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS r2_url TEXT;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS r2_uploaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE m3u_channels ADD COLUMN IF NOT EXISTS content_type VARCHAR(10) CHECK (content_type IN ('live', 'vod', 'unknown')) DEFAULT 'unknown';

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
  status VARCHAR(20) CHECK (status IN ('pending', 'downloading', 'processing', 'completed', 'failed')) DEFAULT 'pending',
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
COMMENT ON COLUMN vod_downloads.status IS 'Status do download: pending (aguardando), downloading (baixando), processing (processando), completed (completo), failed (falhou)';
COMMENT ON COLUMN vod_downloads.segment_count IS 'Total de segmentos .ts para baixar';
COMMENT ON COLUMN vod_downloads.segments_downloaded IS 'Quantidade de segmentos já baixados';
COMMENT ON COLUMN vod_downloads.retry_count IS 'Número de tentativas de download já realizadas';

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

-- Admins têm acesso completo
DROP POLICY IF EXISTS "Admins full access vod_downloads" ON vod_downloads;
CREATE POLICY "Admins full access vod_downloads" 
  ON vod_downloads 
  FOR ALL 
  USING (is_admin(auth.uid()));

-- Sistema pode inserir e atualizar downloads
DROP POLICY IF EXISTS "System can manage vod_downloads" ON vod_downloads;
CREATE POLICY "System can manage vod_downloads" 
  ON vod_downloads 
  FOR ALL 
  USING (true);

-- ==================== STEP 6: Função para limpar downloads antigos ====================
CREATE OR REPLACE FUNCTION cleanup_old_vod_downloads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remover downloads completos ou falhados com mais de 7 dias
  DELETE FROM vod_downloads
  WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '7 days';
    
  -- Remover downloads pendentes com mais de 24 horas (timeout)
  DELETE FROM vod_downloads
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

COMMENT ON FUNCTION cleanup_old_vod_downloads IS 'Remove registros antigos de downloads (completos/falhados > 7 dias, pendentes > 24h)';

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
    SUM(COALESCE((SELECT file_size_bytes FROM vod_downloads WHERE channel_id = m3u_channels.id AND status = 'completed' LIMIT 1), 0))::BIGINT as total_storage_bytes,
    ROUND(AVG(COALESCE((SELECT file_size_bytes FROM vod_downloads WHERE channel_id = m3u_channels.id AND status = 'completed' LIMIT 1), 0)) / 1048576.0, 2) as avg_file_size_mb
  FROM m3u_channels;
END;
$$;

COMMENT ON FUNCTION get_vod_statistics IS 'Retorna estatísticas completas do sistema de VOD';

-- ==================== STEP 8: View para monitoramento de VOD ====================
CREATE OR REPLACE VIEW vw_vod_status AS
SELECT 
  c.id as channel_id,
  c.name as channel_name,
  c.stream_url as original_url,
  c.is_vod,
  c.r2_uploaded,
  c.r2_url,
  c.r2_uploaded_at,
  c.content_type,
  cat.name as category_name,
  lst.name as list_name,
  d.status as download_status,
  d.segments_downloaded,
  d.segment_count,
  CASE 
    WHEN d.segment_count > 0 THEN ROUND((d.segments_downloaded::NUMERIC / d.segment_count::NUMERIC) * 100, 2)
    ELSE 0
  END as download_progress_pct,
  d.file_size_bytes,
  d.error_message,
  d.retry_count,
  d.download_started_at,
  d.download_completed_at
FROM m3u_channels c
LEFT JOIN m3u_categories cat ON c.category_id = cat.id
LEFT JOIN m3u_custom_lists lst ON cat.custom_list_id = lst.id
LEFT JOIN LATERAL (
  SELECT * FROM vod_downloads 
  WHERE channel_id = c.id 
  ORDER BY created_at DESC 
  LIMIT 1
) d ON true
WHERE c.is_vod = true
ORDER BY c.created_at DESC;

COMMENT ON VIEW vw_vod_status IS 'View consolidada com status de todos os VODs e seus downloads';

-- ==================== FINALIZAÇÃO ====================
-- Executar limpeza inicial
SELECT cleanup_old_vod_downloads();

-- Exibir estatísticas
SELECT * FROM get_vod_statistics();
