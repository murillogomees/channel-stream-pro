-- ================================================
-- TABELAS RESTANTES PARA COMPATIBILIDADE TOTAL
-- ================================================

-- Adicionar colunas faltantes à migration_audit
ALTER TABLE public.migration_audit 
ADD COLUMN IF NOT EXISTS rows_affected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Adicionar colunas faltantes à affiliate_referrals
ALTER TABLE public.affiliate_referrals
ADD COLUMN IF NOT EXISTS commission_earned NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS plan_value NUMERIC(10,2) DEFAULT 0;

-- Tabela de clicks em links de afiliados
CREATE TABLE public.affiliate_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT
);

-- Tabela de configurações PWA
CREATE TABLE public.pwa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL DEFAULT 'IPTVLink',
  short_name TEXT DEFAULT 'IPTV',
  description TEXT,
  theme_color TEXT DEFAULT '#000000',
  background_color TEXT DEFAULT '#000000',
  display TEXT DEFAULT 'standalone',
  orientation TEXT DEFAULT 'portrait',
  icon_192 TEXT,
  icon_512 TEXT,
  screenshots JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configurações MercadoPago
CREATE TABLE public.mercado_pago_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_access_token TEXT,
  production_access_token TEXT,
  public_key TEXT,
  webhook_secret TEXT,
  use_sandbox BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de resoluções de auditoria RLS
CREATE TABLE public.rls_audit_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_hash TEXT NOT NULL,
  table_name TEXT NOT NULL,
  policy_name TEXT,
  issue_type TEXT NOT NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de templates de notificação
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configurações de variáveis
CREATE TABLE public.template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_key TEXT NOT NULL UNIQUE,
  variable_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configurações WhatsApp
CREATE TABLE public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key TEXT,
  auth_key TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de fila de notificações
CREATE TABLE public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  template_key TEXT,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cupons de desconto
CREATE TABLE public.discount_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  min_purchase_amount NUMERIC(10,2),
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de user subscriptions
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'trial',
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  mercado_pago_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pagamentos
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  external_id TEXT,
  external_provider TEXT DEFAULT 'mercado_pago',
  metadata JSONB,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.affiliate_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercado_pago_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rls_audit_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Affiliate link clicks
CREATE POLICY "Admins can manage clicks" ON public.affiliate_link_clicks FOR ALL USING (public.is_admin_or_master());
CREATE POLICY "Anyone can insert clicks" ON public.affiliate_link_clicks FOR INSERT WITH CHECK (true);

-- PWA settings
CREATE POLICY "Anyone can view pwa settings" ON public.pwa_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage pwa settings" ON public.pwa_settings FOR ALL USING (public.is_admin_or_master());

-- MercadoPago config
CREATE POLICY "Admins can manage mp config" ON public.mercado_pago_config FOR ALL USING (public.is_admin_or_master());

-- RLS audit resolutions
CREATE POLICY "Admins can manage rls resolutions" ON public.rls_audit_resolutions FOR ALL USING (public.is_admin_or_master());

-- Notification templates
CREATE POLICY "Admins can manage templates" ON public.notification_templates FOR ALL USING (public.is_admin_or_master());

-- Template variables
CREATE POLICY "Anyone can view variables" ON public.template_variables FOR SELECT USING (true);
CREATE POLICY "Admins can manage variables" ON public.template_variables FOR ALL USING (public.is_admin_or_master());

-- WhatsApp config
CREATE POLICY "Admins can manage whatsapp" ON public.whatsapp_config FOR ALL USING (public.is_admin_or_master());

-- Notification queue
CREATE POLICY "Admins can manage queue" ON public.notification_queue FOR ALL USING (public.is_admin_or_master());

-- Discount coupons
CREATE POLICY "Anyone can view active coupons" ON public.discount_coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage coupons" ON public.discount_coupons FOR ALL USING (public.is_admin_or_master());

-- User subscriptions
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions FOR ALL USING (public.is_admin_or_master());

-- Payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (public.is_admin_or_master());