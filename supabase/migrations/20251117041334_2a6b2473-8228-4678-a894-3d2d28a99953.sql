-- Criar tabela para armazenar status de saúde das playlists
CREATE TABLE IF NOT EXISTS public.playlist_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL,
  m3u_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, inactive, error
  response_time_ms INTEGER,
  http_status_code INTEGER,
  error_message TEXT,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'inactive', 'error'))
);

-- Criar índices para melhor performance
CREATE INDEX idx_playlist_health_client ON public.playlist_health_checks(client_id);
CREATE INDEX idx_playlist_health_status ON public.playlist_health_checks(status);
CREATE INDEX idx_playlist_health_checked ON public.playlist_health_checks(last_checked_at DESC);

-- Habilitar RLS
ALTER TABLE public.playlist_health_checks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem visualizar health checks"
  ON public.playlist_health_checks
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir health checks"
  ON public.playlist_health_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar health checks"
  ON public.playlist_health_checks
  FOR UPDATE
  TO authenticated
  USING (true);

-- Comentários
COMMENT ON TABLE public.playlist_health_checks IS 'Armazena resultados de verificações de saúde das playlists M3U';
COMMENT ON COLUMN public.playlist_health_checks.status IS 'Status: pending (aguardando), active (funcionando), inactive (inativa), error (erro)';
COMMENT ON COLUMN public.playlist_health_checks.response_time_ms IS 'Tempo de resposta em milissegundos';
COMMENT ON COLUMN public.playlist_health_checks.http_status_code IS 'Código HTTP retornado pela URL';