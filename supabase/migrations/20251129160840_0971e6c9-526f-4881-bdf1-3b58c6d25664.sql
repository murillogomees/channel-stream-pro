-- Atualizar função get_vod_statistics para usar m3u_sync_entries (onde os VODs são detectados)
CREATE OR REPLACE FUNCTION public.get_vod_statistics()
RETURNS TABLE (
  total_vods BIGINT,
  vods_uploaded BIGINT,
  vods_pending BIGINT,
  downloads_in_progress BIGINT,
  downloads_failed BIGINT,
  downloads_paused BIGINT,
  total_storage_bytes BIGINT,
  avg_file_size_mb NUMERIC,
  blocked_hosts INTEGER,
  active_downloads INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total de VODs detectados na tabela m3u_sync_entries
    (SELECT COUNT(*)::BIGINT FROM m3u_sync_entries WHERE is_vod = true AND is_valid = true) as total_vods,
    
    -- VODs já enviados para R2 (baseado em vod_downloads completed ou m3u_channels com r2_uploaded)
    (SELECT COUNT(DISTINCT COALESCE(vd.channel_id::text, mse.id::text))::BIGINT 
     FROM m3u_sync_entries mse
     LEFT JOIN vod_downloads vd ON vd.channel_id::text = mse.id::text AND vd.status = 'completed'
     LEFT JOIN m3u_channels mc ON mc.stream_url = mse.stream_url AND mc.r2_uploaded = true
     WHERE mse.is_vod = true AND mse.is_valid = true 
       AND (vd.status = 'completed' OR mc.r2_uploaded = true)
    ) as vods_uploaded,
    
    -- VODs pendentes (detectados mas não baixados nem em progresso)
    (SELECT COUNT(*)::BIGINT 
     FROM m3u_sync_entries mse
     WHERE mse.is_vod = true AND mse.is_valid = true
       AND NOT EXISTS (
         SELECT 1 FROM vod_downloads vd 
         WHERE vd.channel_id::text = mse.id::text 
           AND vd.status IN ('completed', 'downloading', 'processing', 'queued', 'paused')
       )
       AND NOT EXISTS (
         SELECT 1 FROM m3u_channels mc 
         WHERE mc.stream_url = mse.stream_url AND mc.r2_uploaded = true
       )
    ) as vods_pending,
    
    -- Downloads em progresso
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status IN ('downloading', 'processing')) as downloads_in_progress,
    
    -- Downloads falhados
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status = 'failed') as downloads_failed,
    
    -- Downloads pausados
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status = 'paused') as downloads_paused,
    
    -- Total de bytes armazenados
    (SELECT COALESCE(SUM(file_size_bytes), 0)::BIGINT FROM vod_downloads WHERE status = 'completed') as total_storage_bytes,
    
    -- Tamanho médio dos arquivos em MB
    ROUND(COALESCE(
      (SELECT AVG(file_size_bytes)::NUMERIC / 1048576.0 FROM vod_downloads WHERE status = 'completed' AND file_size_bytes > 0), 
      0
    ), 2) as avg_file_size_mb,
    
    -- Hosts bloqueados (circuit breaker)
    (SELECT COUNT(*)::INTEGER FROM vod_host_status WHERE blocked_until > NOW()) as blocked_hosts,
    
    -- Downloads ativos (atualizados nos últimos 2 minutos)
    (SELECT COUNT(*)::INTEGER FROM vod_downloads WHERE status = 'downloading' AND updated_at > NOW() - INTERVAL '2 minutes') as active_downloads;
END;
$$;