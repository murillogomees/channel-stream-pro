-- Dropar a tabela m3u_sync_entries (não mais usada - consolidada em iptv_channels)
DROP TABLE IF EXISTS m3u_sync_entries CASCADE;

-- Dropar tabela m3u_sync_sources que depende de m3u_sync_entries
DROP TABLE IF EXISTS m3u_sync_sources CASCADE;

-- Dropar funções que referenciam m3u_sync_entries
DROP FUNCTION IF EXISTS get_m3u_distinct_categories() CASCADE;
DROP FUNCTION IF EXISTS get_sync_statistics() CASCADE;
DROP FUNCTION IF EXISTS get_vod_statistics() CASCADE;

-- Recriar função get_sync_statistics usando iptv_channels
CREATE OR REPLACE FUNCTION get_sync_statistics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'channels', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM iptv_channels),
      'healthy', (SELECT COUNT(*) FROM iptv_channels WHERE is_healthy = true),
      'unhealthy', (SELECT COUNT(*) FROM iptv_channels WHERE is_healthy = false)
    ),
    'categories', (SELECT COUNT(DISTINCT category) FROM iptv_channels WHERE category IS NOT NULL)
  );
$$;

-- Recriar função get_m3u_distinct_categories usando iptv_channels
CREATE OR REPLACE FUNCTION get_m3u_distinct_categories()
RETURNS TABLE(group_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT category as group_title
  FROM iptv_channels
  WHERE category IS NOT NULL
  ORDER BY category;
$$;