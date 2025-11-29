-- Atualizar função get_vod_statistics para incluir dados do CDN entries
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
    -- Total de VODs detectados nas entradas CDN
    (SELECT COUNT(*)::BIGINT FROM m3u_sync_entries WHERE is_vod = true AND is_valid = true) as total_vods,
    -- VODs já enviados para R2 (ainda usa m3u_channels para tracking de uploads)
    (SELECT COUNT(*)::BIGINT FROM m3u_channels WHERE r2_uploaded = true) as vods_uploaded,
    -- VODs pendentes = VODs detectados - VODs já uploadados
    (SELECT COUNT(*)::BIGINT FROM m3u_sync_entries WHERE is_vod = true AND is_valid = true) - 
    (SELECT COUNT(*)::BIGINT FROM m3u_channels WHERE r2_uploaded = true) as vods_pending,
    -- Downloads em andamento
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status IN ('downloading', 'processing', 'queued')) as downloads_in_progress,
    -- Downloads com falha
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status = 'failed') as downloads_failed,
    -- Storage total usado
    COALESCE((SELECT SUM(file_size_bytes)::BIGINT FROM vod_downloads WHERE status = 'completed'), 0) as total_storage_bytes,
    -- Média de tamanho por arquivo
    COALESCE(ROUND((SELECT AVG(file_size_bytes) FROM vod_downloads WHERE status = 'completed' AND file_size_bytes > 0) / 1048576.0, 2), 0) as avg_file_size_mb;
END;
$$;

COMMENT ON FUNCTION get_vod_statistics IS 'Retorna estatísticas do sistema VOD baseado nas entradas CDN';