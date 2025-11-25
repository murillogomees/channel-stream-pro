-- Criar tabela de templates do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  type TEXT NOT NULL DEFAULT 'local' CHECK (type IN ('local', 'botbot')),
  botbot_template_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('expiration', 'welcome_trial', 'welcome_plan', 'renewal', 'payment_reminder')),
  days_before_due INTEGER,
  arquivo JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_event_type ON whatsapp_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_active ON whatsapp_templates(active);

-- Adicionar trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies para whatsapp_templates
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar templates"
  ON whatsapp_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Inserir templates padrão
INSERT INTO whatsapp_templates (name, message, event_type, days_before_due, type) VALUES
(
  'Vencimento Hoje',
  E'Olá {{nome}}! 👋\n\nSeu plano {{plano}} vence HOJE ({{dataVencimento}}).\n\nPara renovar e manter seu acesso:\n{{linkPagamento}}\n\nQualquer dúvida, estamos à disposição! 📞',
  'expiration',
  0,
  'local'
),
(
  'Vencimento em 3 dias',
  E'Olá {{nome}}! 👋\n\nLembrete: Seu plano {{plano}} vence em 3 dias ({{dataVencimento}}).\n\nPara renovar:\n{{linkPagamento}}\n\nQualquer dúvida, estamos à disposição! 📞',
  'expiration',
  3,
  'local'
),
(
  'Vencimento em 7 dias',
  E'Olá {{nome}}! 👋\n\nSeu plano {{plano}} vence em 7 dias ({{dataVencimento}}).\n\nLembre-se de renovar para continuar aproveitando! 🎬\n\nRenovar agora:\n{{linkPagamento}}',
  'expiration',
  7,
  'local'
),
(
  'Boas-vindas - Período de Teste',
  E'Olá {{nome}}! 👋\n\nBem-vindo ao nosso serviço! 🎉\n\nSeu período de teste começou e você já pode aproveitar todos os recursos.\n\nSeu teste vai até: {{dataVencimento}}\n\nQualquer dúvida, estamos à disposição! 📞\n{{telefone}}',
  'welcome_trial',
  NULL,
  'local'
),
(
  'Boas-vindas - Plano Ativo',
  E'Olá {{nome}}! 👋\n\nParabéns! Seu plano {{plano}} está ativo! 🎉\n\nSeu próximo vencimento: {{dataVencimento}}\n\nAproveite todo o conteúdo disponível! 🎬\n\nQualquer dúvida, estamos à disposição! 📞\n{{telefone}}',
  'welcome_plan',
  NULL,
  'local'
),
(
  'Confirmação de Renovação',
  E'Olá {{nome}}! 👋\n\nPagamento confirmado! ✅\n\nSeu plano {{plano}} foi renovado com sucesso.\n\nPróximo vencimento: {{dataVencimento}}\n\nObrigado pela confiança! 🙏',
  'renewal',
  NULL,
  'local'
);