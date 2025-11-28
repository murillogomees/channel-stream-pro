-- Tabela de Planos de Assinatura
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'R$',
  period TEXT NOT NULL,
  period_months INTEGER NOT NULL DEFAULT 1,
  features TEXT[] NOT NULL DEFAULT '{}',
  cta_text TEXT NOT NULL DEFAULT 'Assinar Agora',
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  savings_amount DECIMAL(10,2),
  savings_percent DECIMAL(5,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  whatsapp_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Conteúdo da Homepage
CREATE TABLE public.homepage_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Tabela de FAQs
CREATE TABLE public.homepage_faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_subscription_plans_updated_at();

CREATE TRIGGER update_homepage_content_updated_at
BEFORE UPDATE ON public.homepage_content
FOR EACH ROW EXECUTE FUNCTION public.update_subscription_plans_updated_at();

CREATE TRIGGER update_homepage_faqs_updated_at
BEFORE UPDATE ON public.homepage_faqs
FOR EACH ROW EXECUTE FUNCTION public.update_subscription_plans_updated_at();

-- Habilitar RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_faqs ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública (para exibir na homepage)
CREATE POLICY "Planos ativos são públicos" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Conteúdo da homepage é público" ON public.homepage_content
  FOR SELECT USING (true);

CREATE POLICY "FAQs ativos são públicos" ON public.homepage_faqs
  FOR SELECT USING (is_active = true);

-- Políticas de admin para gerenciamento
CREATE POLICY "Admins podem gerenciar planos" ON public.subscription_plans
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem gerenciar conteúdo" ON public.homepage_content
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem gerenciar FAQs" ON public.homepage_faqs
  FOR ALL USING (public.is_admin(auth.uid()));

-- Inserir planos existentes
INSERT INTO public.subscription_plans (name, slug, price, period, period_months, features, is_highlighted, savings_amount, savings_percent, display_order, whatsapp_message)
VALUES 
  ('Mensal', 'mensal', 30.00, '/mês', 1, 
   ARRAY['Mais de 10.000 canais', 'Qualidade Full HD e 4K', 'Suporte 24/7', 'Sem contrato'], 
   false, NULL, NULL, 1, 'Olá! Tenho interesse no plano Mensal. Gostaria de mais informações.'),
  
  ('Trimestral', 'trimestral', 79.90, '/3 meses', 3, 
   ARRAY['Mais de 10.000 canais', 'Qualidade Full HD e 4K', 'Suporte prioritário 24/7', 'Sem contrato', 'Economize R$ 10'], 
   true, 10.10, 11.2, 2, 'Olá! Tenho interesse no plano Trimestral. Gostaria de mais informações.'),
  
  ('Semestral', 'semestral', 149.90, '/6 meses', 6, 
   ARRAY['Mais de 10.000 canais', 'Qualidade Full HD e 4K', 'Suporte VIP 24/7', 'Sem contrato', 'Economize R$ 30'], 
   false, 30.10, 16.7, 3, 'Olá! Tenho interesse no plano Semestral. Gostaria de mais informações.'),
  
  ('Anual', 'anual', 279.90, '/ano', 12, 
   ARRAY['Mais de 10.000 canais', 'Qualidade Full HD e 4K', 'Suporte VIP dedicado 24/7', 'Sem contrato', 'Economize R$ 80'], 
   false, 80.10, 22.3, 4, 'Olá! Tenho interesse no plano Anual. Gostaria de mais informações.');

-- Inserir conteúdo da homepage
INSERT INTO public.homepage_content (section_key, content)
VALUES 
  ('hero', '{
    "description": "Mais de 10.000 canais em Full HD e 4K com qualidade premium e estabilidade incomparável",
    "features": ["Teste Grátis 15 Dias", "Sem Contrato", "Suporte 24/7"],
    "cta_primary_text": "Ativar Meu Acesso Agora",
    "cta_secondary_text": "Falar com Suporte",
    "trust_indicators": ["Sem Contrato", "Suporte 24/7", "Acesso Global", "Cancele Quando Quiser"],
    "whatsapp_number": "556131425880",
    "whatsapp_message": "Olá! Gostaria de fazer o teste grátis do IPTV."
  }'::jsonb),
  
  ('plans', '{
    "title": "Planos e Preços",
    "subtitle": "Escolha o plano ideal para você e sua família",
    "trial_text": "🔥 Teste Grátis por 24 horas em todos os planos",
    "benefits": ["Sem taxa de instalação", "Sem fidelidade", "Cancele quando quiser", "Acesso imediato"],
    "whatsapp_number": "556131425880"
  }'::jsonb),
  
  ('faq', '{
    "title": "Perguntas Frequentes",
    "subtitle": "Tire suas dúvidas sobre planos, pagamento e funcionamento do serviço",
    "contact_text": "Não encontrou a resposta que procurava?",
    "contact_button_text": "Fale Conosco no WhatsApp",
    "whatsapp_number": "556131425880",
    "whatsapp_message": "Olá! Tenho uma dúvida sobre os planos"
  }'::jsonb),
  
  ('contact', '{
    "whatsapp_number": "556131425880",
    "operating_hours": "24 horas por dia, 7 dias por semana",
    "support_services": ["Ativação de acesso", "Suporte técnico", "Dúvidas sobre planos", "Renovação de assinatura"]
  }'::jsonb),
  
  ('footer', '{
    "copyright": "© 2024 IPTV Link. Todos os direitos reservados.",
    "social_links": {}
  }'::jsonb);

-- Inserir FAQs existentes
INSERT INTO public.homepage_faqs (question, answer, display_order)
VALUES 
  ('Como funciona o período de teste grátis?', 'Você tem direito a 15 dias de teste grátis em qualquer plano. Durante esse período, você terá acesso completo a todos os 10.000+ canais, filmes e séries em Full HD e 4K. Não é necessário cadastrar cartão de crédito para o teste.', 1),
  ('Quais são as formas de pagamento aceitas?', 'Aceitamos PIX (aprovação instantânea), transferência bancária (TED), boleto bancário, cartão de crédito e cartão de débito. O PIX é a forma mais rápida de ativar sua assinatura.', 2),
  ('Posso cancelar minha assinatura a qualquer momento?', 'Sim! Não há contrato de fidelidade. Você pode cancelar sua assinatura a qualquer momento sem multas ou taxas adicionais. Basta entrar em contato com nosso suporte via WhatsApp.', 3),
  ('Qual a diferença entre os planos?', 'Todos os planos incluem acesso completo a mais de 10.000 canais em Full HD e 4K. A diferença está no período de assinatura e na economia: quanto maior o período contratado, maior o desconto. Por exemplo, o plano anual oferece 22.3% de economia comparado ao pagamento mensal.', 4),
  ('Quantos dispositivos posso usar simultaneamente?', 'Sua assinatura permite uso em múltiplos dispositivos da sua residência, incluindo Smart TVs, tablets, smartphones (Android/iOS), computadores e notebooks. Consulte nosso suporte para detalhes específicos do seu plano.', 5),
  ('Como faço para instalar o aplicativo?', 'O processo é simples: baixe o app SmartOne IPTV na loja de aplicativos do seu dispositivo, instale, acesse as configurações e localize o endereço MAC. Envie-nos o MAC via WhatsApp e configuraremos sua conta. Temos um tutorial completo passo a passo disponível.', 6),
  ('Os canais funcionam em qualidade HD e 4K?', 'Sim! Oferecemos transmissão em Full HD e 4K (quando disponível), garantindo a melhor qualidade de imagem. A qualidade final depende também da sua conexão de internet - recomendamos no mínimo 10 Mbps para HD e 25 Mbps para 4K.', 7),
  ('Preciso de internet para assistir?', 'Sim, o serviço IPTV funciona através da internet. Recomendamos uma conexão estável de pelo menos 10 Mbps para assistir em HD e 25 Mbps para 4K. Quanto melhor sua internet, melhor será a qualidade da transmissão.', 8),
  ('Posso assistir em qualquer lugar do mundo?', 'Sim! Você pode acessar sua conta de qualquer lugar com conexão à internet. Todos os canais e conteúdos estarão disponíveis independente da sua localização geográfica.', 9),
  ('Como funciona o suporte técnico?', 'Oferecemos suporte 24/7 via WhatsApp para todos os planos. Planos trimestrais, semestrais e anuais têm atendimento prioritário. Nossa equipe está sempre disponível para ajudar com instalação, configuração e dúvidas.', 10),
  ('O que acontece quando minha assinatura vence?', 'Você receberá notificações por WhatsApp 5 dias antes do vencimento. Após o vencimento, você tem até 5 dias para renovar antes do serviço ser suspenso. A renovação é simples e pode ser feita via WhatsApp.', 11),
  ('Posso mudar de plano depois?', 'Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. Entre em contato via WhatsApp e nossa equipe fará o ajuste, considerando o período já pago da sua assinatura atual.', 12);