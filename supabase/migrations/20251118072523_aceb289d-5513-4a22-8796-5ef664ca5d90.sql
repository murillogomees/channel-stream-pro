-- Criar tabela de tags para categorização de listas M3U
CREATE TABLE IF NOT EXISTS public.m3u_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'qualidade', 'tipo', 'regiao', 'idioma'
  color TEXT, -- Cor hexadecimal para UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(name, category)
);

-- Criar tabela de relação many-to-many entre listas M3U e tags
CREATE TABLE IF NOT EXISTS public.m3u_list_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  m3u_list_id UUID NOT NULL REFERENCES public.m3u_lists(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.m3u_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(m3u_list_id, tag_id)
);

-- Criar tabela de histórico de visualizações
CREATE TABLE IF NOT EXISTS public.m3u_view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  m3u_list_id UUID NOT NULL REFERENCES public.m3u_lists(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_name TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  view_type TEXT DEFAULT 'view', -- 'view', 'edit', 'export'
  metadata JSONB
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.m3u_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_list_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_view_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para m3u_tags
CREATE POLICY "Admins podem visualizar tags"
  ON public.m3u_tags FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar tags"
  ON public.m3u_tags FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar tags"
  ON public.m3u_tags FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar tags"
  ON public.m3u_tags FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para m3u_list_tags
CREATE POLICY "Admins podem visualizar relações de tags"
  ON public.m3u_list_tags FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar relações de tags"
  ON public.m3u_list_tags FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar relações de tags"
  ON public.m3u_list_tags FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas RLS para m3u_view_history
CREATE POLICY "Admins podem visualizar histórico"
  ON public.m3u_view_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir histórico"
  ON public.m3u_view_history FOR INSERT
  WITH CHECK (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_m3u_tags_category ON public.m3u_tags(category);
CREATE INDEX IF NOT EXISTS idx_m3u_list_tags_list_id ON public.m3u_list_tags(m3u_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_list_tags_tag_id ON public.m3u_list_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_m3u_view_history_list_id ON public.m3u_view_history(m3u_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_view_history_admin_id ON public.m3u_view_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_m3u_view_history_viewed_at ON public.m3u_view_history(viewed_at DESC);

-- Inserir tags padrão
INSERT INTO public.m3u_tags (name, category, color) VALUES
  -- Qualidade
  ('HD', 'qualidade', '#3b82f6'),
  ('Full HD', 'qualidade', '#2563eb'),
  ('4K', 'qualidade', '#1d4ed8'),
  ('SD', 'qualidade', '#94a3b8'),
  -- Tipo
  ('Filmes', 'tipo', '#10b981'),
  ('Séries', 'tipo', '#059669'),
  ('Esportes', 'tipo', '#f59e0b'),
  ('Documentários', 'tipo', '#8b5cf6'),
  ('Infantil', 'tipo', '#ec4899'),
  ('Notícias', 'tipo', '#ef4444'),
  ('Variedades', 'tipo', '#06b6d4'),
  -- Região
  ('Brasil', 'regiao', '#22c55e'),
  ('América Latina', 'regiao', '#84cc16'),
  ('Estados Unidos', 'regiao', '#0ea5e9'),
  ('Europa', 'regiao', '#6366f1'),
  ('Internacional', 'regiao', '#a855f7'),
  -- Idioma
  ('Português', 'idioma', '#f97316'),
  ('Inglês', 'idioma', '#14b8a6'),
  ('Espanhol', 'idioma', '#eab308'),
  ('Multi-idioma', 'idioma', '#78716c')
ON CONFLICT (name, category) DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE public.m3u_tags IS 'Tags para categorização de listas M3U (qualidade, tipo, região, idioma)';
COMMENT ON TABLE public.m3u_list_tags IS 'Relação many-to-many entre listas M3U e tags';
COMMENT ON TABLE public.m3u_view_history IS 'Histórico de visualizações e interações de admins com listas M3U';