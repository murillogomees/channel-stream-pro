-- Criar tabelas que faltaram na primeira migração

-- 5. Hash perceptual para detecção de streams duplicados
CREATE TABLE IF NOT EXISTS iptv_stream_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id BIGINT REFERENCES iptv_channels(id) ON DELETE CASCADE,
  perceptual_hash TEXT NOT NULL,
  hash_algorithm TEXT DEFAULT 'phash',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Agrupamento de streams (mesmo conteúdo, fontes diferentes)
CREATE TABLE IF NOT EXISTS iptv_stream_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_channel_id BIGINT REFERENCES iptv_channels(id),
  display_name TEXT,
  source_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON iptv_stream_fingerprints(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_fingerprints_channel ON iptv_stream_fingerprints(channel_id);
CREATE INDEX IF NOT EXISTS idx_stream_groups_canonical ON iptv_stream_groups(canonical_channel_id);

-- Função para normalizar texto
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF input_text IS NULL THEN RETURN NULL; END IF;
  RETURN lower(trim(regexp_replace(
    translate(input_text,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiioooooúuuuçnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^a-z0-9 ]', '', 'gi')));
END;
$$;

-- Função para gerar source_hash
CREATE OR REPLACE FUNCTION generate_source_hash(url TEXT, name TEXT, category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN md5(COALESCE(url, '') || '|' || COALESCE(normalize_text(name), '') || '|' || COALESCE(normalize_text(category), ''));
END;
$$;

-- RLS
ALTER TABLE iptv_stream_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE iptv_stream_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read fingerprints" ON iptv_stream_fingerprints;
DROP POLICY IF EXISTS "Anyone can read stream_groups" ON iptv_stream_groups;
DROP POLICY IF EXISTS "Admins can manage fingerprints" ON iptv_stream_fingerprints;
DROP POLICY IF EXISTS "Admins can manage stream_groups" ON iptv_stream_groups;

CREATE POLICY "Anyone can read fingerprints" ON iptv_stream_fingerprints FOR SELECT USING (true);
CREATE POLICY "Anyone can read stream_groups" ON iptv_stream_groups FOR SELECT USING (true);
CREATE POLICY "Admins can manage fingerprints" ON iptv_stream_fingerprints FOR ALL USING (is_admin_or_master());
CREATE POLICY "Admins can manage stream_groups" ON iptv_stream_groups FOR ALL USING (is_admin_or_master());