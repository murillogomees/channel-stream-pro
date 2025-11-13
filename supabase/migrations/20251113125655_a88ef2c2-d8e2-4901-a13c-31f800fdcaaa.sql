-- =====================================================
-- IPTV LINK - Estrutura Completa do Banco de Dados
-- =====================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.situacao_cliente AS ENUM ('Testando', 'Ativo', 'Devendo', 'Inativo', 'Lead');
CREATE TYPE public.plano_cliente AS ENUM ('Mensal', 'Trimestral', 'Semestral', 'Anual');
CREATE TYPE public.smartone_status AS ENUM ('nao_enviado', 'pendente', 'criado', 'erro');
CREATE TYPE public.origem_cadastro AS ENUM ('Google Ads', 'Facebook', 'Instagram', 'Indicação', 'Website', 'Outro');

-- 2. TABELA DE ROLES DE USUÁRIOS
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. FUNÇÃO SECURITY DEFINER PARA VERIFICAR ROLES
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. TABELA DE ADMINS
CREATE TABLE public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os admins"
ON public.admins FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem inserir admins"
ON public.admins FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar admins"
ON public.admins FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 5. TABELA DE LISTAS M3U
CREATE TABLE public.m3u_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.m3u_lists ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_m3u_lists_default ON public.m3u_lists(is_default) WHERE is_default = true;

-- Função para garantir apenas uma lista padrão
CREATE OR REPLACE FUNCTION public.ensure_single_default_m3u()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.m3u_lists 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_ensure_single_default_m3u
  BEFORE INSERT OR UPDATE ON public.m3u_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_m3u();

CREATE POLICY "Admins podem gerenciar listas M3U"
ON public.m3u_lists FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários autenticados podem visualizar listas ativas"
ON public.m3u_lists FOR SELECT
USING (status = 'active');

-- 6. TABELA DE CLIENTES
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    telegram TEXT,
    email TEXT,
    situacao situacao_cliente DEFAULT 'Testando',
    data_contratacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
    data_vencimento TIMESTAMP WITH TIME ZONE,
    plano plano_cliente DEFAULT 'Mensal',
    valor_pago NUMERIC(10,2) DEFAULT 0,
    data_ultimo_pagamento TIMESTAMP WITH TIME ZONE,
    forma_ultimo_pagamento TEXT,
    mac_smart_one TEXT,
    usuario_m3u TEXT,
    senha_m3u TEXT,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT now(),
    data_ultima_edicao TIMESTAMP WITH TIME ZONE DEFAULT now(),
    cliente_ativo BOOLEAN DEFAULT true,
    smartone_status smartone_status DEFAULT 'nao_enviado',
    smartone_playlist_id TEXT,
    smartone_raw_response TEXT,
    smartone_last_sync_at TIMESTAMP WITH TIME ZONE,
    origem_cadastro origem_cadastro DEFAULT 'Website'
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar clientes"
ON public.clientes FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 7. TABELA DE TEMPLATES DE NOTIFICAÇÃO
CREATE TABLE public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    variables JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar templates"
ON public.notification_templates FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 8. TABELA DE LOGS DE NOTIFICAÇÃO
CREATE TABLE public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    template_name TEXT,
    phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
    message_content TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar logs"
ON public.notification_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 9. TABELA DE TELEFONES DE ADMIN PARA NOTIFICAÇÕES
CREATE TABLE public.admin_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admin_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar telefones"
ON public.admin_phones FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 10. TABELA DE MÉTRICAS WEBSOCKET
CREATE TABLE public.metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metrics_type TEXT DEFAULT 'websocket',
    total_connections INTEGER DEFAULT 0,
    successful_connections INTEGER DEFAULT 0,
    failed_connections INTEGER DEFAULT 0,
    average_latency NUMERIC(10,2) DEFAULT 0,
    total_reconnections INTEGER DEFAULT 0,
    current_status TEXT,
    events_sent INTEGER DEFAULT 0,
    events_received INTEGER DEFAULT 0,
    events_failed INTEGER DEFAULT 0
);

ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar métricas"
ON public.metrics_snapshots FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 11. TABELA DE HEALTH SNAPSHOTS
CREATE TABLE public.health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    overall_status TEXT,
    websocket_status TEXT,
    websocket_latency NUMERIC(10,2),
    supabase_status TEXT,
    supabase_latency NUMERIC(10,2),
    whatsapp_status TEXT,
    whatsapp_latency NUMERIC(10,2),
    smartone_status TEXT,
    smartone_latency NUMERIC(10,2)
);

ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem visualizar health"
ON public.health_snapshots FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 12. FUNÇÃO PARA CLEANUP DE MÉTRICAS ANTIGAS
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.metrics_snapshots 
  WHERE timestamp < now() - interval '30 days';
  
  DELETE FROM public.health_snapshots 
  WHERE timestamp < now() - interval '30 days';
END;
$$;

-- 13. TRIGGER PARA ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_m3u_lists_updated_at
  BEFORE UPDATE ON public.m3u_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_clientes_situacao ON public.clientes(situacao);
CREATE INDEX idx_clientes_data_vencimento ON public.clientes(data_vencimento);
CREATE INDEX idx_clientes_mac ON public.clientes(mac_smart_one);
CREATE INDEX idx_notification_logs_cliente ON public.notification_logs(cliente_id);
CREATE INDEX idx_notification_logs_sent_at ON public.notification_logs(sent_at);

-- 15. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON TABLE public.clientes IS 'Tabela principal de clientes do sistema IPTV';
COMMENT ON TABLE public.m3u_lists IS 'Listas M3U disponíveis para atribuição aos clientes';
COMMENT ON COLUMN public.m3u_lists.is_default IS 'Indica se esta é a lista M3U padrão usada para novos cadastros e testes grátis';
COMMENT ON FUNCTION public.has_role IS 'Função security definer para verificar roles sem recursão RLS';
COMMENT ON FUNCTION public.ensure_single_default_m3u IS 'Garante que apenas uma lista M3U seja marcada como padrão por vez';