-- Criar tabela de relacionamento entre clientes e listas M3U
CREATE TABLE IF NOT EXISTS public.client_m3u_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  m3u_list_id UUID NOT NULL REFERENCES public.m3u_lists(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(client_id, m3u_list_id)
);

-- Índices para performance
CREATE INDEX idx_client_m3u_lists_client_id ON public.client_m3u_lists(client_id);
CREATE INDEX idx_client_m3u_lists_m3u_list_id ON public.client_m3u_lists(m3u_list_id);
CREATE INDEX idx_client_m3u_lists_active ON public.client_m3u_lists(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.client_m3u_lists ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar atribuições de M3U"
  ON public.client_m3u_lists
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver suas próprias listas"
  ON public.client_m3u_lists
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clientes WHERE user_id = auth.uid()
    )
  );

-- Comentários
COMMENT ON TABLE public.client_m3u_lists IS 'Relacionamento entre clientes e listas M3U atribuídas';
COMMENT ON COLUMN public.client_m3u_lists.client_id IS 'ID do cliente';
COMMENT ON COLUMN public.client_m3u_lists.m3u_list_id IS 'ID da lista M3U';
COMMENT ON COLUMN public.client_m3u_lists.assigned_at IS 'Data/hora da atribuição';
COMMENT ON COLUMN public.client_m3u_lists.assigned_by IS 'ID do admin que fez a atribuição';
COMMENT ON COLUMN public.client_m3u_lists.is_active IS 'Se a lista está ativa para este cliente';