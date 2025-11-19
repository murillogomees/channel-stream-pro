-- =====================================================
-- Sistema de Gerenciamento de Listas M3U Personalizadas
-- =====================================================

-- Tabela de listas M3U personalizadas
CREATE TABLE IF NOT EXISTS public.m3u_custom_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  cdn_url TEXT,
  bucket_path TEXT,
  total_channels INTEGER DEFAULT 0,
  total_categories INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de categorias personalizadas
CREATE TABLE IF NOT EXISTS public.m3u_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_list_id UUID NOT NULL REFERENCES public.m3u_custom_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  order_position INTEGER DEFAULT 0,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de canais personalizados
CREATE TABLE IF NOT EXISTS public.m3u_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.m3u_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tvg_id TEXT,
  tvg_name TEXT,
  tvg_logo TEXT,
  group_title TEXT,
  stream_url TEXT NOT NULL,
  order_position INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de geração
CREATE TABLE IF NOT EXISTS public.m3u_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_list_id UUID NOT NULL REFERENCES public.m3u_custom_lists(id) ON DELETE CASCADE,
  file_size BIGINT,
  channels_count INTEGER,
  generation_time_ms INTEGER,
  cdn_upload_status TEXT CHECK (cdn_upload_status IN ('success', 'failed')),
  cdn_upload_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de atribuições de listas aos clientes
CREATE TABLE IF NOT EXISTS public.client_m3u_custom_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  custom_list_id UUID NOT NULL REFERENCES public.m3u_custom_lists(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(cliente_id, custom_list_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_m3u_custom_lists_status ON public.m3u_custom_lists(status);
CREATE INDEX IF NOT EXISTS idx_m3u_custom_lists_slug ON public.m3u_custom_lists(slug);
CREATE INDEX IF NOT EXISTS idx_m3u_categories_list ON public.m3u_categories(custom_list_id);
CREATE INDEX IF NOT EXISTS idx_m3u_channels_category ON public.m3u_channels(category_id);
CREATE INDEX IF NOT EXISTS idx_m3u_generation_logs_list ON public.m3u_generation_logs(custom_list_id);
CREATE INDEX IF NOT EXISTS idx_client_m3u_assignments_client ON public.client_m3u_custom_assignments(cliente_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_m3u_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_m3u_custom_lists_updated_at
  BEFORE UPDATE ON public.m3u_custom_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_m3u_updated_at();

CREATE TRIGGER trigger_m3u_channels_updated_at
  BEFORE UPDATE ON public.m3u_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_m3u_updated_at();

-- RLS Policies
ALTER TABLE public.m3u_custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_m3u_custom_assignments ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso completo
CREATE POLICY "Admins full access m3u_custom_lists" ON public.m3u_custom_lists
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access m3u_categories" ON public.m3u_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access m3u_channels" ON public.m3u_channels
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access m3u_generation_logs" ON public.m3u_generation_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access client_m3u_custom_assignments" ON public.client_m3u_custom_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Clientes podem ver suas próprias atribuições
CREATE POLICY "Clients view own assignments" ON public.client_m3u_custom_assignments
  FOR SELECT USING (
    cliente_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.m3u_custom_lists IS 'Listas M3U personalizadas criadas pelos admins';
COMMENT ON TABLE public.m3u_categories IS 'Categorias personalizadas dentro de cada lista M3U';
COMMENT ON TABLE public.m3u_channels IS 'Canais personalizados dentro de cada categoria';
COMMENT ON TABLE public.m3u_generation_logs IS 'Histórico de gerações de arquivos M3U';
COMMENT ON TABLE public.client_m3u_custom_assignments IS 'Atribuição de listas M3U personalizadas aos clientes';