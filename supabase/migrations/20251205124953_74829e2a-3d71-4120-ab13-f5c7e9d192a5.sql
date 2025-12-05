-- =====================================================
-- Migration: Fix SECURITY DEFINER views
-- Description: Recreate views with security_invoker = true to respect RLS
-- =====================================================

-- 1. profiles_safe - view segura de profiles sem campos sensíveis
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS SELECT 
  id, nome, email, contact_phone, telefone, telefone_whatsapp,
  created_at, updated_at, theme, situacao, plano, data_vencimento,
  data_contratacao, cliente_ativo, data_ultimo_pagamento, is_recorrente,
  dispositivo_contratado, origem_cadastro, mac_smart_one, totp_enabled,
  totp_verified_at,
  CASE WHEN totp_enabled = true THEN true ELSE false END AS has_2fa
FROM profiles;

-- 2. vw_expiration_summary - resumo de vencimentos
DROP VIEW IF EXISTS public.vw_expiration_summary;
CREATE VIEW public.vw_expiration_summary
WITH (security_invoker = true)
AS SELECT 
  id, nome, telefone, email, plano, valor_pago, situacao,
  data_vencimento, is_recorrente, forma_ultimo_pagamento,
  data_ultimo_pagamento, origem_cadastro,
  CASE WHEN data_ultimo_pagamento > (CURRENT_DATE - '30 days'::interval) THEN true ELSE false END AS pagamento_recente,
  EXTRACT(day FROM (data_vencimento - CURRENT_DATE))::integer AS dias_ate_vencimento
FROM clientes
WHERE situacao = ANY (ARRAY['Ativo'::situacao_cliente, 'Testando'::situacao_cliente, 'Devendo'::situacao_cliente]);

-- 3. vw_host_status - status de hosts VOD
DROP VIEW IF EXISTS public.vw_host_status;
CREATE VIEW public.vw_host_status 
WITH (security_invoker = true)
AS SELECT 
  host, consecutive_failures, total_failures, total_successes, blocked_until,
  CASE 
    WHEN blocked_until > now() THEN 'blocked'
    WHEN consecutive_failures >= 3 THEN 'warning'
    ELSE 'healthy'
  END AS health_status,
  avg_download_speed_bps,
  round(avg_download_speed_bps::numeric / 1048576.0, 2) AS avg_speed_mbps,
  last_failure_at, last_success_at,
  (SELECT count(*) FROM m3u_channels c WHERE c.stream_url LIKE '%' || h.host || '%' AND c.is_vod = true) AS vod_count,
  updated_at
FROM vod_host_status h 
ORDER BY consecutive_failures DESC, total_failures DESC;

-- 4. vw_ingest_metrics_summary - métricas de ingestão por hora
DROP VIEW IF EXISTS public.vw_ingest_metrics_summary;
CREATE VIEW public.vw_ingest_metrics_summary
WITH (security_invoker = true)
AS SELECT 
  date_trunc('hour', created_at) AS hour,
  count(*) AS total_requests,
  count(*) FILTER (WHERE status = 'success') AS successful,
  count(*) FILTER (WHERE status = 'failed') AS failed,
  round(avg(bytes_transferred), 0) AS avg_bytes,
  round(avg(duration_ms), 0) AS avg_duration_ms,
  sum(bytes_transferred) AS total_bytes,
  round((count(*) FILTER (WHERE status = 'failed')::numeric / NULLIF(count(*)::numeric, 0)) * 100, 2) AS error_rate_pct,
  count(*) FILTER (WHERE ingest_method = 'stream') AS stream_count,
  count(*) FILTER (WHERE ingest_method = 'signed_url') AS signed_url_count,
  count(*) FILTER (WHERE ingest_method = 'fallback') AS fallback_count,
  round(avg(retry_count), 2) AS avg_retries
FROM m3u_ingest_metrics
WHERE created_at > (now() - '7 days'::interval)
GROUP BY date_trunc('hour', created_at)
ORDER BY hour DESC;

-- 5. vw_playlist_metrics - métricas de playlists
DROP VIEW IF EXISTS public.vw_playlist_metrics;
CREATE VIEW public.vw_playlist_metrics
WITH (security_invoker = true)
AS SELECT 
  p.id,
  p.filename,
  p.user_id,
  p.channel_count,
  p.unique_count,
  p.quarantined_count,
  p.size_bytes,
  p.created_at,
  p.expires_at,
  p.archived,
  CASE 
    WHEN p.expires_at IS NULL THEN 'permanent'
    WHEN p.expires_at < now() THEN 'expired'
    WHEN p.expires_at < now() + '7 days'::interval THEN 'expiring_soon'
    ELSE 'active'
  END AS status
FROM playlists p
WHERE p.archived = false;

-- 6. vw_storage_consolidated - storage consolidado
DROP VIEW IF EXISTS public.vw_storage_consolidated;
CREATE VIEW public.vw_storage_consolidated
WITH (security_invoker = true)
AS SELECT 
  'r2' AS storage_type,
  count(*) AS object_count,
  COALESCE(sum(size_bytes), 0) AS total_bytes,
  round(COALESCE(sum(size_bytes), 0)::numeric / 1073741824, 2) AS total_gb,
  count(*) FILTER (WHERE status = 'ready') AS ready_count,
  count(*) FILTER (WHERE status IN ('pending', 'uploading')) AS pending_count
FROM r2_storage_objects
UNION ALL
SELECT 
  'cloudflare_stream' AS storage_type,
  count(*) AS object_count,
  COALESCE(sum((metadata->>'size_bytes')::bigint), 0) AS total_bytes,
  round(COALESCE(sum((metadata->>'size_bytes')::bigint), 0)::numeric / 1073741824, 2) AS total_gb,
  count(*) FILTER (WHERE status = 'ready') AS ready_count,
  count(*) FILTER (WHERE status IN ('pending', 'processing')) AS pending_count
FROM cf_stream_uploads;

-- 7. Remover view órfã que referencia tabela inexistente
DROP VIEW IF EXISTS public.vw_stream_performance;