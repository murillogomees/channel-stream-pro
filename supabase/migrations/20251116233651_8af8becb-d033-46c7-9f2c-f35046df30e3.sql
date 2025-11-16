-- Criar tabela de templates de alertas de segurança
CREATE TABLE IF NOT EXISTS public.security_alert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  template_name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_type, template_name)
);

-- RLS
ALTER TABLE public.security_alert_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar templates de alertas"
  ON public.security_alert_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Índices
CREATE INDEX idx_security_alert_templates_event_type ON public.security_alert_templates(event_type);
CREATE INDEX idx_security_alert_templates_enabled ON public.security_alert_templates(enabled);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_security_alert_templates_updated_at
  BEFORE UPDATE ON public.security_alert_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Templates padrão
INSERT INTO public.security_alert_templates (event_type, template_name, message_template, enabled) VALUES
(
  'failed_login',
  'Alerta de Login Falhou',
  '🚨 *ALERTA DE SEGURANÇA*

*Tipo:* Login Falhou
*Severidade:* {severity}
*Data/Hora:* {timestamp}
*IP:* {ip_address}
*Email:* {email}

⚠️ Múltiplas tentativas de login falharam.

_Acesse o painel de segurança para mais detalhes._',
  true
),
(
  'permission_change',
  'Alerta de Mudança de Permissão',
  '⚠️ *ALERTA DE SEGURANÇA*

*Tipo:* Mudança de Permissão
*Severidade:* {severity}
*Data/Hora:* {timestamp}
*IP:* {ip_address}
*Mudança:* {old_role} → {new_role}

🔐 Permissões de usuário foram alteradas.

_Acesse o painel de segurança para mais detalhes._',
  true
),
(
  'suspicious_activity',
  'Alerta de Atividade Suspeita',
  '🚨 *ALERTA DE SEGURANÇA*

*Tipo:* Atividade Suspeita
*Severidade:* {severity}
*Data/Hora:* {timestamp}
*IP:* {ip_address}
*Descrição:* {description}

🕵️ Atividade suspeita detectada no sistema.

_Acesse o painel de segurança para mais detalhes._',
  true
),
(
  'rate_limit_exceeded',
  'Alerta de Limite Excedido',
  '⚠️ *ALERTA DE SEGURANÇA*

*Tipo:* Limite Excedido
*Severidade:* {severity}
*Data/Hora:* {timestamp}
*IP:* {ip_address}
*Endpoint:* {endpoint}

⏱️ Limite de requisições excedido.

_Acesse o painel de segurança para mais detalhes._',
  true
),
(
  'unauthorized_access',
  'Alerta de Acesso Não Autorizado',
  '🚨 *ALERTA DE SEGURANÇA*

*Tipo:* Acesso Não Autorizado
*Severidade:* {severity}
*Data/Hora:* {timestamp}
*IP:* {ip_address}
*Recurso:* {resource}

🚫 Tentativa de acesso não autorizado.

_Acesse o painel de segurança para mais detalhes._',
  true
);