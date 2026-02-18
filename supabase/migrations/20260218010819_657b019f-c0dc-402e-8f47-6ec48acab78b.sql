
-- =============================================
-- Fase 1.2: Tabela sigma_blaze_config
-- =============================================
CREATE TABLE public.sigma_blaze_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  admin_whatsapp_number text NOT NULL DEFAULT '',
  whatsapp_message_template text NOT NULL DEFAULT 'Olá, quero ativar meu acesso.',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sigma_blaze_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master can read sigma_blaze_config"
  ON public.sigma_blaze_config FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can insert sigma_blaze_config"
  ON public.sigma_blaze_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update sigma_blaze_config"
  ON public.sigma_blaze_config FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete sigma_blaze_config"
  ON public.sigma_blaze_config FOR DELETE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_sigma_blaze_config_updated_at
  BEFORE UPDATE ON public.sigma_blaze_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.sigma_blaze_config (api_url, api_key, admin_whatsapp_number)
VALUES ('', '', '');

-- =============================================
-- Fase 1.3: Tabela subscription_package_mapping
-- =============================================
CREATE TABLE public.subscription_package_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_plan_id uuid NOT NULL,
  internal_plan_name text NOT NULL DEFAULT '',
  sigma_package_id text NOT NULL DEFAULT '',
  sigma_package_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_internal_plan UNIQUE (internal_plan_id)
);

ALTER TABLE public.subscription_package_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master can read subscription_package_mapping"
  ON public.subscription_package_mapping FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can insert subscription_package_mapping"
  ON public.subscription_package_mapping FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can update subscription_package_mapping"
  ON public.subscription_package_mapping FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Admin/master can delete subscription_package_mapping"
  ON public.subscription_package_mapping FOR DELETE
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE TRIGGER update_subscription_package_mapping_updated_at
  BEFORE UPDATE ON public.subscription_package_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Fase 1.4: Tabela sigma_blaze_logs
-- =============================================
CREATE TABLE public.sigma_blaze_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  status text NOT NULL,
  user_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sigma_blaze_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master can read sigma_blaze_logs"
  ON public.sigma_blaze_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Service can insert sigma_blaze_logs"
  ON public.sigma_blaze_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- =============================================
-- Fase 1.1: Feature Flags (INSERT data)
-- =============================================
INSERT INTO public.feature_flag_config (flag_name, enabled, percentage, description) VALUES
  ('SIGMA_AUTO_CREATE_CLIENT', false, 0, 'Criação automática de cliente no Sigma Blaze'),
  ('SIGMA_AUTO_DELETE_CLIENT', false, 0, 'Exclusão automática de cliente no Sigma Blaze'),
  ('SIGMA_AUTO_UPDATE_PACKAGE', false, 0, 'Atualização automática de pacote no Sigma Blaze'),
  ('SIGMA_WHATSAPP_ACTIVATION', false, 0, 'Fluxo de ativação via WhatsApp (modo manual)')
ON CONFLICT (flag_name) DO NOTHING;
