-- Adicionar campos de VOD na tabela m3u_sync_entries
ALTER TABLE m3u_sync_entries ADD COLUMN IF NOT EXISTS is_vod BOOLEAN DEFAULT false;
ALTER TABLE m3u_sync_entries ADD COLUMN IF NOT EXISTS content_type VARCHAR(10) CHECK (content_type IN ('live', 'vod', 'unknown')) DEFAULT 'unknown';

COMMENT ON COLUMN m3u_sync_entries.is_vod IS 'Indica se a entrada é VOD (Video on Demand)';
COMMENT ON COLUMN m3u_sync_entries.content_type IS 'Tipo de conteúdo: live (ao vivo), vod (sob demanda), unknown (não identificado)';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_is_vod ON m3u_sync_entries(is_vod) WHERE is_vod = true;
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_content_type ON m3u_sync_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_group_title_lower ON m3u_sync_entries(LOWER(group_title));
CREATE INDEX IF NOT EXISTS idx_m3u_sync_entries_stream_url_lower ON m3u_sync_entries(LOWER(stream_url));

-- Função para detectar VODs a partir das entradas CDN (m3u_sync_entries)
CREATE OR REPLACE FUNCTION detect_vod_from_sync_entries()
RETURNS TABLE(
  updated_count BIGINT,
  vod_count BIGINT,
  live_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  v_updated BIGINT := 0;
  v_vod BIGINT := 0;
  v_live BIGINT := 0;
  v_batch_size INT := 5000;
  v_offset INT := 0;
  v_total INT;
BEGIN
  -- Contar total de entradas
  SELECT COUNT(*) INTO v_total FROM m3u_sync_entries WHERE is_valid = true;
  
  -- Processar em batches para evitar timeout
  WHILE v_offset < v_total LOOP
    -- Marcar como VOD baseado em padrões de categoria e URL
    WITH updated AS (
      UPDATE m3u_sync_entries
      SET 
        is_vod = true,
        content_type = 'vod'
      WHERE id IN (
        SELECT id FROM m3u_sync_entries
        WHERE is_valid = true
          AND is_vod = false
          AND (
            -- Padrões de filmes na categoria
            LOWER(group_title) LIKE '%filme%'
            OR LOWER(group_title) LIKE '%movie%'
            OR LOWER(group_title) LIKE '%cinema%'
            OR LOWER(group_title) LIKE '%lançamento%'
            OR LOWER(group_title) LIKE '%lancamento%'
            -- Padrões de séries
            OR LOWER(group_title) LIKE '%serie%'
            OR LOWER(group_title) LIKE '%séries%'
            OR LOWER(group_title) LIKE '%series%'
            OR LOWER(group_title) LIKE '%temporada%'
            OR LOWER(group_title) LIKE '%season%'
            OR LOWER(group_title) LIKE '%episod%'
            -- Padrões de VOD gerais
            OR LOWER(group_title) LIKE '%vod%'
            OR LOWER(group_title) LIKE '%on demand%'
            OR LOWER(group_title) LIKE '%sob demanda%'
            -- Padrões infantis VOD
            OR LOWER(group_title) LIKE '%kids%'
            OR LOWER(group_title) LIKE '%infantil%'
            OR LOWER(group_title) LIKE '%desenho%'
            OR LOWER(group_title) LIKE '%animação%'
            OR LOWER(group_title) LIKE '%animation%'
            -- Padrões de documentários
            OR LOWER(group_title) LIKE '%documentar%'
            OR LOWER(group_title) LIKE '%documentary%'
            -- Padrões na URL
            OR LOWER(stream_url) LIKE '%/movie/%'
            OR LOWER(stream_url) LIKE '%/vod/%'
            OR LOWER(stream_url) LIKE '%/series/%'
            OR LOWER(stream_url) LIKE '%/filme/%'
            OR LOWER(stream_url) LIKE '%type=movie%'
            OR LOWER(stream_url) LIKE '%type=series%'
            -- Extensões típicas de VOD
            OR LOWER(stream_url) LIKE '%.mp4'
            OR LOWER(stream_url) LIKE '%.mkv'
            OR LOWER(stream_url) LIKE '%.avi'
          )
        LIMIT v_batch_size
      )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_updated FROM updated;
    
    v_offset := v_offset + v_batch_size;
  END LOOP;
  
  -- Marcar entradas restantes como LIVE (que não são VOD e não tem padrão de live)
  UPDATE m3u_sync_entries
  SET content_type = 'live'
  WHERE is_valid = true
    AND is_vod = false
    AND content_type = 'unknown';
  
  -- Contar resultados
  SELECT COUNT(*) INTO v_vod FROM m3u_sync_entries WHERE is_vod = true AND is_valid = true;
  SELECT COUNT(*) INTO v_live FROM m3u_sync_entries WHERE content_type = 'live' AND is_valid = true;
  
  -- Calcular quantos foram atualizados nesta execução
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN QUERY SELECT v_vod, v_vod, v_live;
END;
$$;

COMMENT ON FUNCTION detect_vod_from_sync_entries IS 'Detecta e marca automaticamente entradas CDN como VOD baseado em padrões de categoria e URL';