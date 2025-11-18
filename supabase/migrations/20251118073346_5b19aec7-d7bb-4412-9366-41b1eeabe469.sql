-- Criar tabela de favoritos de listas M3U
CREATE TABLE IF NOT EXISTS public.m3u_list_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  m3u_list_id UUID NOT NULL REFERENCES public.m3u_lists(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(admin_id, m3u_list_id)
);

-- RLS policies para favoritos
ALTER TABLE public.m3u_list_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar próprios favoritos"
  ON public.m3u_list_favorites
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_m3u_list_favorites_admin_id ON public.m3u_list_favorites(admin_id);
CREATE INDEX IF NOT EXISTS idx_m3u_list_favorites_m3u_list_id ON public.m3u_list_favorites(m3u_list_id);

-- Comentários
COMMENT ON TABLE public.m3u_list_favorites IS 'Listas M3U marcadas como favoritas por administradores';
COMMENT ON COLUMN public.m3u_list_favorites.admin_id IS 'ID do administrador que marcou como favorito';
COMMENT ON COLUMN public.m3u_list_favorites.m3u_list_id IS 'ID da lista M3U favorita';