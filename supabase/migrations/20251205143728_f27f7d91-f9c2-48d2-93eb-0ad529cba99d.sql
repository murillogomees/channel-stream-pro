-- Create ultra-fast search function using GIN full-text index
CREATE OR REPLACE FUNCTION search_channels_fast(search_term text, result_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  title text,
  stream_url text,
  tvg_logo text,
  tvg_id text,
  tvg_name text,
  group_title text,
  content_type varchar,
  is_vod boolean
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.stream_url,
    e.tvg_logo,
    e.tvg_id,
    e.tvg_name,
    e.group_title,
    e.content_type,
    e.is_vod
  FROM m3u_sync_entries e
  WHERE 
    to_tsvector('portuguese', COALESCE(e.title, '')) @@ plainto_tsquery('portuguese', search_term)
    OR e.title ILIKE '%' || search_term || '%'
    OR e.group_title ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE WHEN e.title ILIKE search_term || '%' THEN 0 ELSE 1 END,
    e.title
  LIMIT result_limit;
END;
$$;