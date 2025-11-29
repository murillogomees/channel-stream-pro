-- ================================================================
-- VOD INGEST PIPELINE ENHANCEMENT
-- ================================================================
-- Adiciona deduplicação por hash, circuit breaker e métricas

-- ==================== STEP 1: Adicionar campos para deduplicação ====================
ALTER TABLE vod_downloads ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE vod_downloads ADD COLUMN IF NOT EXISTS etag TEXT;

-- Índice para deduplicação
CREATE INDEX IF NOT EXISTS idx_vod_downloads_sha256 ON vod_downloads(sha256) WHERE sha256 IS NOT NULL;

-- ==================== STEP 2: Tabela de circuit breaker para hosts ====================
CREATE TABLE IF NOT EXISTS vod_host_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host TEXT NOT NULL UNIQUE,
  consecutive_failures INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  blocked_until TIMESTAMP WITH TIME ZONE,
  avg_download_speed_bps BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vod_host_status_blocked ON vod_host_status(blocked_until) WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vod_host_status_host ON vod_host_status(host);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_vod_host_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vod_host_status_updated_at ON vod_host_status;
CREATE TRIGGER trigger_update_vod_host_status_updated_at
  BEFORE UPDATE ON vod_host_status
  FOR EACH ROW
  EXECUTE FUNCTION update_vod_host_status_updated_at();

-- ==================== STEP 3: RLS para vod_host_status ====================
ALTER TABLE vod_host_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access vod_host_status" ON vod_host_status;
CREATE POLICY "Admins full access vod_host_status" 
  ON vod_host_status 
  FOR ALL 
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "System can manage vod_host_status" ON vod_host_status;
CREATE POLICY "System can manage vod_host_status" 
  ON vod_host_status 
  FOR ALL 
  USING (true);

-- ==================== STEP 4: Função para verificar circuit breaker ====================
CREATE OR REPLACE FUNCTION check_host_circuit_breaker(p_url TEXT)
RETURNS TABLE(
  is_blocked BOOLEAN,
  blocked_until TIMESTAMP WITH TIME ZONE,
  consecutive_failures INTEGER,
  host TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host TEXT;
  v_status RECORD;
BEGIN
  -- Extrair host da URL
  v_host := (regexp_match(p_url, '^https?://([^/]+)'))[1];
  
  -- Buscar status do host
  SELECT * INTO v_status FROM vod_host_status WHERE vod_host_status.host = v_host;
  
  IF NOT FOUND THEN
    -- Host não registrado, permitir
    RETURN QUERY SELECT false, NULL::TIMESTAMP WITH TIME ZONE, 0, v_host;
    RETURN;
  END IF;
  
  -- Verificar se está bloqueado
  IF v_status.blocked_until IS NOT NULL AND v_status.blocked_until > NOW() THEN
    RETURN QUERY SELECT true, v_status.blocked_until, v_status.consecutive_failures, v_host;
    RETURN;
  END IF;
  
  -- Se bloqueio expirou, resetar
  IF v_status.blocked_until IS NOT NULL AND v_status.blocked_until <= NOW() THEN
    UPDATE vod_host_status SET blocked_until = NULL, consecutive_failures = 0 WHERE vod_host_status.host = v_host;
  END IF;
  
  RETURN QUERY SELECT false, NULL::TIMESTAMP WITH TIME ZONE, v_status.consecutive_failures, v_host;
END;
$$;

-- ==================== STEP 5: Função para registrar falha de host ====================
CREATE OR REPLACE FUNCTION record_host_failure(p_url TEXT, p_error TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host TEXT;
  v_failures INTEGER;
  v_block_duration INTERVAL;
BEGIN
  v_host := (regexp_match(p_url, '^https?://([^/]+)'))[1];
  
  INSERT INTO vod_host_status (host, consecutive_failures, total_failures, last_failure_at)
  VALUES (v_host, 1, 1, NOW())
  ON CONFLICT (host) DO UPDATE SET
    consecutive_failures = vod_host_status.consecutive_failures + 1,
    total_failures = vod_host_status.total_failures + 1,
    last_failure_at = NOW();
  
  -- Obter número de falhas consecutivas
  SELECT consecutive_failures INTO v_failures FROM vod_host_status WHERE host = v_host;
  
  -- Circuit breaker: bloquear após 5 falhas consecutivas
  -- Duração do bloqueio aumenta exponencialmente: 5min, 15min, 30min, 1h, 2h, 4h (max)
  IF v_failures >= 5 THEN
    v_block_duration := LEAST(POWER(2, LEAST(v_failures - 5, 5))::INTEGER * INTERVAL '5 minutes', INTERVAL '4 hours');
    UPDATE vod_host_status SET blocked_until = NOW() + v_block_duration WHERE host = v_host;
    RAISE NOTICE 'Host % bloqueado por % após % falhas', v_host, v_block_duration, v_failures;
  END IF;
END;
$$;

-- ==================== STEP 6: Função para registrar sucesso de host ====================
CREATE OR REPLACE FUNCTION record_host_success(p_url TEXT, p_bytes BIGINT DEFAULT NULL, p_duration_ms INTEGER DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host TEXT;
  v_speed BIGINT;
BEGIN
  v_host := (regexp_match(p_url, '^https?://([^/]+)'))[1];
  
  -- Calcular velocidade se temos dados
  IF p_bytes IS NOT NULL AND p_duration_ms IS NOT NULL AND p_duration_ms > 0 THEN
    v_speed := (p_bytes * 1000 / p_duration_ms)::BIGINT;
  END IF;
  
  INSERT INTO vod_host_status (host, consecutive_failures, total_successes, last_success_at, avg_download_speed_bps)
  VALUES (v_host, 0, 1, NOW(), v_speed)
  ON CONFLICT (host) DO UPDATE SET
    consecutive_failures = 0,
    total_successes = vod_host_status.total_successes + 1,
    last_success_at = NOW(),
    blocked_until = NULL,
    avg_download_speed_bps = COALESCE(
      (vod_host_status.avg_download_speed_bps * 0.8 + COALESCE(v_speed, vod_host_status.avg_download_speed_bps) * 0.2)::BIGINT,
      v_speed
    );
END;
$$;

-- ==================== STEP 7: Função para buscar VOD por hash (deduplicação) ====================
CREATE OR REPLACE FUNCTION find_vod_by_hash(p_sha256 TEXT)
RETURNS TABLE(
  channel_id UUID,
  r2_url TEXT,
  file_size_bytes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.channel_id, d.r2_url, d.file_size_bytes
  FROM vod_downloads d
  WHERE d.sha256 = p_sha256
    AND d.status = 'completed'
    AND d.r2_url IS NOT NULL
  LIMIT 1;
END;
$$;

-- ==================== STEP 8: Atualizar função de estatísticas ====================
DROP FUNCTION IF EXISTS get_vod_statistics();
CREATE OR REPLACE FUNCTION get_vod_statistics()
RETURNS TABLE(
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
    COUNT(*) FILTER (WHERE m.is_vod = true)::BIGINT as total_vods,
    COUNT(*) FILTER (WHERE m.r2_uploaded = true)::BIGINT as vods_uploaded,
    COUNT(*) FILTER (WHERE m.is_vod = true AND m.r2_uploaded = false)::BIGINT as vods_pending,
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status IN ('downloading', 'processing')) as downloads_in_progress,
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status = 'failed') as downloads_failed,
    (SELECT COUNT(*)::BIGINT FROM vod_downloads WHERE status = 'paused') as downloads_paused,
    COALESCE(SUM(COALESCE((SELECT d.file_size_bytes FROM vod_downloads d WHERE d.channel_id = m.id AND d.status = 'completed' LIMIT 1), 0)), 0)::BIGINT as total_storage_bytes,
    ROUND(AVG(COALESCE((SELECT d.file_size_bytes FROM vod_downloads d WHERE d.channel_id = m.id AND d.status = 'completed' LIMIT 1), 0)) / 1048576.0, 2) as avg_file_size_mb,
    (SELECT COUNT(*)::INTEGER FROM vod_host_status WHERE blocked_until > NOW()) as blocked_hosts,
    (SELECT COUNT(*)::INTEGER FROM vod_downloads WHERE status = 'downloading' AND updated_at > NOW() - INTERVAL '2 minutes') as active_downloads
  FROM m3u_channels m;
END;
$$;

-- ==================== STEP 9: Função para limpar downloads órfãos ====================
CREATE OR REPLACE FUNCTION cleanup_orphaned_downloads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Downloads travados há mais de 10 minutos sem atualização
  UPDATE vod_downloads
  SET 
    status = 'paused',
    error_message = 'Resetado automaticamente - download travado'
  WHERE status = 'downloading'
    AND updated_at < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Downloads pendentes há mais de 1 hora
  UPDATE vod_downloads
  SET 
    status = 'failed',
    error_message = 'Timeout - pendente por muito tempo'
  WHERE status IN ('queued', 'pending')
    AND created_at < NOW() - INTERVAL '1 hour';
  
  RETURN v_count;
END;
$$;

-- ==================== STEP 10: View para monitoramento de hosts ====================
CREATE OR REPLACE VIEW vw_host_status AS
SELECT 
  h.host,
  h.consecutive_failures,
  h.total_failures,
  h.total_successes,
  h.blocked_until,
  CASE 
    WHEN h.blocked_until > NOW() THEN 'blocked'
    WHEN h.consecutive_failures >= 3 THEN 'warning'
    ELSE 'healthy'
  END as health_status,
  h.avg_download_speed_bps,
  ROUND(h.avg_download_speed_bps / 1048576.0, 2) as avg_speed_mbps,
  h.last_failure_at,
  h.last_success_at,
  (SELECT COUNT(*) FROM m3u_channels c WHERE c.stream_url LIKE '%' || h.host || '%' AND c.is_vod = true) as vod_count,
  h.updated_at
FROM vod_host_status h
ORDER BY h.consecutive_failures DESC, h.total_failures DESC;