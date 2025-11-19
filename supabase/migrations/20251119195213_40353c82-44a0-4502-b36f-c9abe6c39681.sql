-- Tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  target_plan VARCHAR(50),
  auto_generated BOOLEAN DEFAULT false,
  conditions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT true
);

-- Tabela de métricas de conversão
CREATE TABLE IF NOT EXISTS public.conversion_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  trial_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  converted BOOLEAN DEFAULT false,
  conversion_date TIMESTAMP WITH TIME ZONE,
  converted_to_plan VARCHAR(50),
  coupon_used UUID REFERENCES public.discount_coupons(id),
  days_to_convert INTEGER,
  touchpoints JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de A/B testing de ofertas
CREATE TABLE IF NOT EXISTS public.ab_test_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name VARCHAR(100) NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela de comportamento durante teste
CREATE TABLE IF NOT EXISTS public.trial_behavior_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de uso de cupons
CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  order_value DECIMAL(10,2),
  discount_applied DECIMAL(10,2)
);

-- Tabela de resultados A/B testing
CREATE TABLE IF NOT EXISTS public.ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.ab_test_offers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  variant_shown VARCHAR(10) NOT NULL CHECK (variant_shown IN ('A', 'B')),
  converted BOOLEAN DEFAULT false,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  converted_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_behavior_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;

-- Policies para discount_coupons
CREATE POLICY "Admins can manage coupons" ON public.discount_coupons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients can view active coupons" ON public.discount_coupons
  FOR SELECT USING (active = true AND valid_until > now());

-- Policies para conversion_metrics
CREATE POLICY "Admins can view all conversion metrics" ON public.conversion_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert conversion metrics" ON public.conversion_metrics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies para ab_test_offers
CREATE POLICY "Admins can manage A/B tests" ON public.ab_test_offers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policies para trial_behavior_tracking
CREATE POLICY "Admins can view behavior tracking" ON public.trial_behavior_tracking
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert behavior tracking" ON public.trial_behavior_tracking
  FOR INSERT WITH CHECK (true);

-- Policies para coupon_usage
CREATE POLICY "Admins can view coupon usage" ON public.coupon_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert coupon usage" ON public.coupon_usage
  FOR INSERT WITH CHECK (true);

-- Policies para ab_test_results
CREATE POLICY "Admins can view A/B test results" ON public.ab_test_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert A/B test results" ON public.ab_test_results
  FOR INSERT WITH CHECK (true);

-- Função para calcular taxa de conversão
CREATE OR REPLACE FUNCTION get_conversion_rate(days_period INTEGER DEFAULT 30)
RETURNS TABLE(
  total_trials BIGINT,
  total_conversions BIGINT,
  conversion_rate NUMERIC,
  avg_days_to_convert NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_trials,
    COUNT(*) FILTER (WHERE converted = true)::BIGINT as total_conversions,
    ROUND(
      (COUNT(*) FILTER (WHERE converted = true)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
      2
    ) as conversion_rate,
    ROUND(AVG(days_to_convert) FILTER (WHERE converted = true), 1) as avg_days_to_convert
  FROM public.conversion_metrics
  WHERE created_at > now() - (days_period || ' days')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar uso de cupom
CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.discount_coupons
  SET current_uses = current_uses + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_coupon_usage
AFTER INSERT ON public.coupon_usage
FOR EACH ROW
EXECUTE FUNCTION increment_coupon_usage();

-- Índices para performance
CREATE INDEX idx_conversion_metrics_client ON public.conversion_metrics(client_id);
CREATE INDEX idx_conversion_metrics_dates ON public.conversion_metrics(trial_start_date, trial_end_date);
CREATE INDEX idx_trial_behavior_client ON public.trial_behavior_tracking(client_id, timestamp);
CREATE INDEX idx_coupon_code ON public.discount_coupons(code) WHERE active = true;
CREATE INDEX idx_ab_test_active ON public.ab_test_offers(id) WHERE active = true;