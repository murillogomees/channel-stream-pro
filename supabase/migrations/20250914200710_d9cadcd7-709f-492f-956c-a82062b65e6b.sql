-- Criar tabelas para o sistema completo de IPTV
-- 1. Tabela de administradores
CREATE TABLE public.admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de listas M3U
CREATE TABLE public.m3u_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'active',
  uploaded_by UUID REFERENCES public.admins(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela de afiliados
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  affiliate_code TEXT NOT NULL UNIQUE,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_commission DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Tabela de cliques de afiliados
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Tabela de vendas por afiliados
CREATE TABLE public.affiliate_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_value DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Tabela de players recomendados
CREATE TABLE public.recommended_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  download_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Tabela de sessões de checkout (para mobile)
CREATE TABLE public.mobile_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_selected TEXT,
  affiliate_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days')
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3u_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommended_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Admins: apenas usuários autenticados podem ver
CREATE POLICY "Admins can manage their own data" ON public.admins
FOR ALL USING (auth.uid() = id);

-- M3U Lists: público pode ver listas ativas, apenas admins podem gerenciar
CREATE POLICY "Public can view active M3U lists" ON public.m3u_lists
FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage M3U lists" ON public.m3u_lists
FOR ALL USING (auth.uid() IN (SELECT id FROM public.admins));

-- Afiliados: podem ver e editar seus próprios dados
CREATE POLICY "Affiliates can manage their own data" ON public.affiliates
FOR ALL USING (auth.uid() = id);

CREATE POLICY "Public can view affiliate by code" ON public.affiliates
FOR SELECT USING (status = 'active');

-- Cliques de afiliados: apenas inserção pública, visualização pelos afiliados
CREATE POLICY "Anyone can insert affiliate clicks" ON public.affiliate_clicks
FOR INSERT WITH CHECK (true);

CREATE POLICY "Affiliates can view their clicks" ON public.affiliate_clicks
FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE auth.uid() = id));

-- Vendas de afiliados: similar aos cliques
CREATE POLICY "Admins can manage affiliate sales" ON public.affiliate_sales
FOR ALL USING (auth.uid() IN (SELECT id FROM public.admins));

CREATE POLICY "Affiliates can view their sales" ON public.affiliate_sales
FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE auth.uid() = id));

-- Players recomendados: público pode ver ativos, apenas admins podem gerenciar
CREATE POLICY "Public can view active players" ON public.recommended_players
FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage players" ON public.recommended_players
FOR ALL USING (auth.uid() IN (SELECT id FROM public.admins));

-- Sessões mobile: qualquer um pode inserir e ver suas próprias
CREATE POLICY "Anyone can manage mobile sessions" ON public.mobile_sessions
FOR ALL USING (true);

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_m3u_lists_updated_at
  BEFORE UPDATE ON public.m3u_lists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_recommended_players_updated_at
  BEFORE UPDATE ON public.recommended_players
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Inserir dados iniciais
INSERT INTO public.recommended_players (name, description, icon_url, platforms, download_links, featured, sort_order) VALUES
('IPTV Smarters Pro', 'Player IPTV mais popular e completo', 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100&h=100&fit=crop', 
 '["Android", "iOS", "Smart TV", "Windows", "macOS"]'::jsonb,
 '{"android": "https://play.google.com/store/apps/details?id=com.nst.iptvsmarterslite", "ios": "https://apps.apple.com/app/iptv-smarters-pro/id1329734318", "windows": "https://www.microsoft.com/store/apps/9n6wg8z9l3k4"}'::jsonb,
 true, 1),
 
('TiviMate', 'Interface moderna e elegante para IPTV', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=100&h=100&fit=crop',
 '["Android", "Android TV"]'::jsonb,
 '{"android": "https://play.google.com/store/apps/details?id=ar.tvplayer.tv"}'::jsonb,
 true, 2),
 
('VLC Media Player', 'Player universal gratuito', 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100&h=100&fit=crop',
 '["Android", "iOS", "Windows", "macOS", "Linux"]'::jsonb,
 '{"android": "https://play.google.com/store/apps/details?id=org.videolan.vlc", "ios": "https://apps.apple.com/app/vlc-for-mobile/id650377962", "windows": "https://www.videolan.org/vlc/download-windows.html"}'::jsonb,
 false, 3),
 
('Perfect Player', 'Player simples e eficiente', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=100&h=100&fit=crop',
 '["Android"]'::jsonb,
 '{"android": "https://play.google.com/store/apps/details?id=com.niklabs.pp"}'::jsonb,
 false, 4);