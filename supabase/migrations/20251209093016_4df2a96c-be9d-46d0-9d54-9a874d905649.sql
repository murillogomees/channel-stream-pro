-- ================================================
-- TABELAS FINAIS FALTANTES
-- ================================================

-- Adicionar colunas à affiliate_analytics
ALTER TABLE public.affiliate_analytics
ADD COLUMN IF NOT EXISTS revenue_generated NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_earned NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_order_value NUMERIC(10,2) DEFAULT 0;

-- Adicionar colunas à affiliate_link_clicks
ALTER TABLE public.affiliate_link_clicks
ADD COLUMN IF NOT EXISTS landing_page TEXT,
ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

-- Tabela de logs de fraude de afiliados
CREATE TABLE public.affiliate_fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de materiais de marketing de afiliados
CREATE TABLE public.affiliate_marketing_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'banner',
  content_url TEXT,
  thumbnail_url TEXT,
  dimensions TEXT,
  file_size INTEGER,
  downloads INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de onboarding de afiliados
CREATE TABLE public.affiliate_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de payouts de afiliados
CREATE TABLE public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de promoções de afiliados
CREATE TABLE public.affiliate_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC(10,2),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de dashboard de afiliados
CREATE TABLE public.affiliate_dashboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  widget_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de reports de afiliados
CREATE TABLE public.affiliate_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  data JSONB,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de histórico de status
CREATE TABLE public.client_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de notificações enviadas
CREATE TABLE public.sent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_phone TEXT,
  template_key TEXT,
  message_content TEXT,
  status TEXT DEFAULT 'sent',
  external_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.affiliate_fraud_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_marketing_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_dashboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud logs" ON public.affiliate_fraud_logs FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can view marketing materials" ON public.affiliate_marketing_materials FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage marketing materials" ON public.affiliate_marketing_materials FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Affiliates can view own onboarding" ON public.affiliate_onboarding FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage onboarding" ON public.affiliate_onboarding FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Affiliates can view own payouts" ON public.affiliate_payouts FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage payouts" ON public.affiliate_payouts FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can view promotions" ON public.affiliate_promotions FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage promotions" ON public.affiliate_promotions FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Affiliates can view own dashboard" ON public.affiliate_dashboard FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Affiliates can manage own dashboard" ON public.affiliate_dashboard FOR ALL USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Affiliates can view own reports" ON public.affiliate_reports FOR SELECT USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage reports" ON public.affiliate_reports FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Admins can manage status history" ON public.client_status_history FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Admins can manage sent notifications" ON public.sent_notifications FOR ALL USING (public.is_admin_or_master());