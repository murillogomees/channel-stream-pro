-- ================================================
-- TABELAS E COLUNAS FINAIS PARA COMPATIBILIDADE TOTAL
-- ================================================

-- Adicionar colunas à affiliate_referrals
ALTER TABLE public.affiliate_referrals
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS commission_value NUMERIC(10,2);

-- Adicionar colunas à affiliate_withdrawals
ALTER TABLE public.affiliate_withdrawals
ADD COLUMN IF NOT EXISTS withdrawal_type TEXT DEFAULT 'standard';

-- Adicionar colunas à discount_coupons
ALTER TABLE public.discount_coupons
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Adicionar colunas à custom_status_badges
ALTER TABLE public.custom_status_badges
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Tabela de notificações de badges admin
CREATE TABLE IF NOT EXISTS public.admin_badge_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID,
  badge_name TEXT NOT NULL,
  badge_rarity TEXT DEFAULT 'common',
  message TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de favoritos admin
CREATE TABLE IF NOT EXISTS public.admin_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(admin_id, item_type, item_id)
);

-- Tabela de widgets dashboard
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de métricas de streaming
CREATE TABLE IF NOT EXISTS public.streaming_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  content_type TEXT,
  duration_seconds INTEGER DEFAULT 0,
  quality TEXT,
  buffering_events INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  device_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de uso de API
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de banners
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  position TEXT DEFAULT 'top',
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de versões de app
CREATE TABLE IF NOT EXISTS public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  release_notes TEXT,
  is_required BOOLEAN DEFAULT false,
  min_version TEXT,
  download_url TEXT,
  released_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.admin_badge_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badge notifications" ON public.admin_badge_notifications FOR SELECT USING (auth.uid() = admin_id);
CREATE POLICY "Users can manage own badge notifications" ON public.admin_badge_notifications FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "Users can manage own favorites" ON public.admin_favorites FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "Users can manage own widgets" ON public.dashboard_widgets FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payment history" ON public.payment_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage payment history" ON public.payment_history FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Users can view own streaming metrics" ON public.streaming_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage streaming metrics" ON public.streaming_metrics FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Admins can manage api usage" ON public.api_usage FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage banners" ON public.banners FOR ALL USING (public.is_admin_or_master());

CREATE POLICY "Anyone can view app versions" ON public.app_versions FOR SELECT USING (true);
CREATE POLICY "Admins can manage app versions" ON public.app_versions FOR ALL USING (public.is_admin_or_master());