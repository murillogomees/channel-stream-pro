
-- Tabela de clientes Sigma Blaze (cache local)
CREATE TABLE public.sigma_blaze_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigma_id text,
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  plan_name text DEFAULT 'Blaze IPTV',
  expiration_date timestamp with time zone NOT NULL,
  last_login timestamp with time zone,
  last_payment_date timestamp with time zone,
  last_reminder_sent timestamp with time zone,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sigma_blaze_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master full access sigma_blaze_clients"
  ON public.sigma_blaze_clients FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Tabela de templates de lembrete
CREATE TABLE public.sigma_reminder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sigma_reminder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master full access sigma_reminder_templates"
  ON public.sigma_reminder_templates FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Inserir templates padrão
INSERT INTO public.sigma_reminder_templates (name, message, is_default) VALUES
  ('Lembrete Padrão', 'Olá {{nome}}, seu plano {{plano}} vence em {{data_vencimento}} ({{dias_restantes}} dias restantes). Renove agora para não perder o acesso!', true),
  ('Urgente - Vencimento Próximo', '⚠️ {{nome}}, seu plano {{plano}} vence em {{dias_restantes}} dia(s)! Renove agora para evitar a suspensão do serviço.', false),
  ('Expirado', '❌ {{nome}}, seu plano {{plano}} expirou em {{data_vencimento}}. Entre em contato para renovar e recuperar seu acesso.', false);

-- Tabela de logs de envio de lembretes
CREATE TABLE public.sigma_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.sigma_blaze_clients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.sigma_reminder_templates(id),
  message_sent text NOT NULL,
  whatsapp_number text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  error_message text,
  sent_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sigma_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/master full access sigma_reminder_logs"
  ON public.sigma_reminder_logs FOR ALL
  TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_sigma_blaze_clients_updated_at
  BEFORE UPDATE ON public.sigma_blaze_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sigma_reminder_templates_updated_at
  BEFORE UPDATE ON public.sigma_reminder_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
