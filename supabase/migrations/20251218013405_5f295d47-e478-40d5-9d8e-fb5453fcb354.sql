-- Criar tabela user_favorites se não existir
CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id integer NOT NULL REFERENCES iptv_channels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- RLS para user_favorites
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins full access favorites" ON user_favorites
  FOR ALL USING (is_admin_or_master());

-- Índices para user_favorites
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_channel ON user_favorites(channel_id);

-- View para favoritos agregados
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_favorites_stats AS
SELECT 
  uf.user_id,
  COUNT(*) as total_favorites,
  COUNT(DISTINCT ic.category) as unique_categories,
  array_agg(DISTINCT ic.category) FILTER (WHERE ic.category IS NOT NULL) as favorite_categories
FROM user_favorites uf
LEFT JOIN iptv_channels ic ON ic.id = uf.channel_id
GROUP BY uf.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_favorites_stats_unique 
ON mv_user_favorites_stats (user_id);

-- Atualizar função de refresh
CREATE OR REPLACE FUNCTION refresh_browse_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_series_catalog;
  REFRESH MATERIALIZED VIEW mv_recent_content;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_content_type_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_viewing_history_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_favorites_stats;
END;
$$;