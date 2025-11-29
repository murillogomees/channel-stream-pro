-- Índices para melhorar performance da detecção de VOD
CREATE INDEX IF NOT EXISTS idx_m3u_channels_is_vod ON public.m3u_channels(is_vod);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_content_type ON public.m3u_channels(content_type);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_stream_url_lower ON public.m3u_channels(LOWER(stream_url));
CREATE INDEX IF NOT EXISTS idx_m3u_channels_group_title_lower ON public.m3u_channels(LOWER(group_title));

-- Recriar função detect_vod_channels com processamento em lotes
CREATE OR REPLACE FUNCTION public.detect_vod_channels()
RETURNS TABLE(updated_count bigint, vod_count bigint, live_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout = '120s'
AS $function$
DECLARE
  v_updated BIGINT := 0;
  v_vod BIGINT := 0;
  v_live BIGINT := 0;
  v_batch_updated BIGINT;
BEGIN
  -- Processar VOD em lotes de 10000
  LOOP
    WITH batch AS (
      SELECT id FROM m3u_channels
      WHERE is_vod = false
        AND (
          LOWER(group_title) LIKE '%filme%'
          OR LOWER(group_title) LIKE '%movie%'
          OR LOWER(group_title) LIKE '%cinema%'
          OR LOWER(group_title) LIKE '%vod%'
          OR LOWER(group_title) LIKE '%serie%'
          OR LOWER(group_title) LIKE '%series%'
          OR LOWER(group_title) LIKE '%temporada%'
          OR LOWER(group_title) LIKE '%season%'
          OR LOWER(stream_url) LIKE '%/movie/%'
          OR LOWER(stream_url) LIKE '%/series/%'
          OR LOWER(stream_url) LIKE '%/vod/%'
        )
      LIMIT 10000
    )
    UPDATE m3u_channels
    SET is_vod = true, content_type = 'vod'
    WHERE id IN (SELECT id FROM batch);
    
    GET DIAGNOSTICS v_batch_updated = ROW_COUNT;
    v_updated := v_updated + v_batch_updated;
    
    EXIT WHEN v_batch_updated = 0;
  END LOOP;
  
  -- Processar LIVE em lotes de 10000
  LOOP
    WITH batch AS (
      SELECT id FROM m3u_channels
      WHERE content_type = 'unknown'
        AND is_vod = false
        AND (
          LOWER(group_title) LIKE '%live%'
          OR LOWER(group_title) LIKE '%ao vivo%'
          OR LOWER(group_title) LIKE '%tv%'
          OR LOWER(stream_url) LIKE '%/live/%'
          OR LOWER(stream_url) LIKE '%.m3u8%'
        )
      LIMIT 10000
    )
    UPDATE m3u_channels
    SET content_type = 'live'
    WHERE id IN (SELECT id FROM batch);
    
    GET DIAGNOSTICS v_batch_updated = ROW_COUNT;
    EXIT WHEN v_batch_updated = 0;
  END LOOP;
  
  -- Contar resultados
  SELECT COUNT(*) INTO v_vod FROM m3u_channels WHERE is_vod = true;
  SELECT COUNT(*) INTO v_live FROM m3u_channels WHERE content_type = 'live';
  
  RETURN QUERY SELECT v_updated, v_vod, v_live;
END;
$function$;