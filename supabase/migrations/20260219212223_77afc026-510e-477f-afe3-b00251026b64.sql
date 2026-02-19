
-- Legal documents (terms, privacy policy) with versioning
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('terms', 'privacy')),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (type, version)
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Everyone can read active documents
CREATE POLICY "Anyone can read active legal documents"
  ON public.legal_documents FOR SELECT
  USING (is_active = true);

-- Admins can manage all documents
CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL
  USING (public.is_admin_or_master(auth.uid()));

-- User legal acceptance log
CREATE TABLE public.user_legal_acceptance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE public.user_legal_acceptance ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptances
CREATE POLICY "Users can read own acceptances"
  ON public.user_legal_acceptance FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own acceptances
CREATE POLICY "Users can insert own acceptances"
  ON public.user_legal_acceptance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all acceptances
CREATE POLICY "Admins can read all acceptances"
  ON public.user_legal_acceptance FOR SELECT
  USING (public.is_admin_or_master(auth.uid()));

-- Index for quick lookups
CREATE INDEX idx_user_legal_acceptance_user ON public.user_legal_acceptance (user_id, document_type);
CREATE INDEX idx_legal_documents_active ON public.legal_documents (type, is_active) WHERE is_active = true;

-- Trigger to ensure only one active version per type
CREATE OR REPLACE FUNCTION public.ensure_single_active_legal_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.legal_documents
    SET is_active = false, updated_at = now()
    WHERE type = NEW.type AND id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_active_legal_document
  BEFORE INSERT OR UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_legal_document();

-- Insert initial documents
INSERT INTO public.legal_documents (type, version, title, content, is_active) VALUES
('terms', '1.0.0', 'Termos de Uso', E'<h2>1. Sobre a Plataforma</h2>\n<p>A <strong>Blaze IPTV</strong> é uma plataforma digital que organiza e disponibiliza conteúdos fornecidos por terceiros, acessíveis via aplicativo próprio. A plataforma atua exclusivamente como interface tecnológica para acesso a conteúdos digitais hospedados por fontes externas, não hospedando diretamente conteúdos protegidos por direitos autorais.</p>\n\n<h2>2. Responsabilidade do Usuário</h2>\n<p>Ao utilizar a plataforma, o usuário declara e garante que:</p>\n<ul>\n<li>Utilizará a plataforma em conformidade com a legislação vigente no Brasil e no país em que se encontra;</li>\n<li>Não realizará engenharia reversa, descompilação ou desmontagem do software da plataforma;</li>\n<li>Não redistribuirá, sublicenciará ou compartilhará seu acesso com terceiros;</li>\n<li>Não utilizará a plataforma para fins ilegais, fraudulentos ou que violem direitos de terceiros;</li>\n<li>Manterá suas credenciais de acesso em sigilo e segurança.</li>\n</ul>\n\n<h2>3. Natureza do Serviço</h2>\n<p>A plataforma atua como interface tecnológica para acesso a conteúdos digitais disponibilizados por provedores externos. O serviço consiste na organização, categorização e disponibilização de acesso a esses conteúdos de forma estruturada e otimizada para o usuário final.</p>\n\n<h2>4. Cancelamento e Suspensão</h2>\n<p>A conta do usuário poderá ser suspensa ou encerrada nos seguintes casos:</p>\n<ul>\n<li>Violação destes Termos de Uso;</li>\n<li>Uso indevido ou fraudulento da plataforma;</li>\n<li>Solicitação expressa do próprio usuário;</li>\n<li>Inadimplência no pagamento da assinatura.</li>\n</ul>\n<p>O cancelamento pode ser solicitado a qualquer momento através do painel do usuário ou por contato com o suporte. Reembolsos serão avaliados caso a caso conforme nossa política de reembolso e o Código de Defesa do Consumidor.</p>\n\n<h2>5. Isenção de Garantias</h2>\n<p>O serviço é fornecido "como está" e "conforme disponível". Não garantimos:</p>\n<ul>\n<li>Disponibilidade contínua e ininterrupta do serviço;</li>\n<li>Ausência de erros, falhas ou interrupções;</li>\n<li>Compatibilidade com todos os dispositivos e conexões de internet.</li>\n</ul>\n<p>O funcionamento adequado da plataforma depende da qualidade da conexão de internet do usuário, das especificações do dispositivo utilizado e de fatores externos fora do nosso controle.</p>\n\n<h2>6. Propriedade Intelectual</h2>\n<p>A marca, o sistema, o design, o código-fonte e todos os elementos visuais e funcionais da plataforma são de propriedade exclusiva da Blaze IPTV ou de seus licenciadores. É expressamente proibido:</p>\n<ul>\n<li>Copiar, reproduzir ou imitar qualquer parte da plataforma;</li>\n<li>Utilizar a marca ou elementos visuais sem autorização prévia por escrito;</li>\n<li>Desenvolver produtos derivados baseados na plataforma.</li>\n</ul>\n\n<h2>7. Atualizações dos Termos</h2>\n<p>Estes Termos de Uso podem ser atualizados periodicamente. Em caso de alterações significativas, o usuário será notificado por e-mail ou através da própria plataforma e deverá aceitar a nova versão para continuar utilizando o serviço.</p>\n\n<h2>8. Cláusula de Isenção</h2>\n<p>A plataforma não hospeda diretamente conteúdos protegidos por direitos autorais e atua exclusivamente como interface tecnológica. Os conteúdos acessíveis através da plataforma são de responsabilidade de seus respectivos provedores e titulares de direitos.</p>\n\n<h2>9. Foro</h2>\n<p>Fica eleito o foro da comarca do domicílio do usuário para dirimir quaisquer questões oriundas destes Termos de Uso, conforme previsto no Código de Defesa do Consumidor (Lei nº 8.078/1990).</p>\n\n<p><em>Última atualização: Fevereiro de 2026</em></p>', true),

('privacy', '1.0.0', 'Política de Privacidade', E'<h2>1. Dados Coletados</h2>\n<p>Para a prestação adequada do serviço, coletamos os seguintes dados pessoais:</p>\n<ul>\n<li><strong>Dados de cadastro:</strong> nome, endereço de e-mail e telefone;</li>\n<li><strong>Dados de acesso:</strong> endereço IP, data e hora de acesso, tipo de navegador e dispositivo;</li>\n<li><strong>Dados de uso:</strong> páginas visitadas, funcionalidades utilizadas e preferências;</li>\n<li><strong>Cookies:</strong> informações armazenadas no navegador para melhorar a experiência.</li>\n</ul>\n\n<h2>2. Finalidade do Tratamento</h2>\n<p>Os dados pessoais coletados são utilizados para as seguintes finalidades:</p>\n<ul>\n<li><strong>Autenticação:</strong> verificação de identidade e controle de acesso à plataforma;</li>\n<li><strong>Suporte:</strong> atendimento ao usuário e resolução de problemas;</li>\n<li><strong>Pagamentos:</strong> processamento de transações e gestão de assinaturas;</li>\n<li><strong>Comunicação:</strong> envio de notificações, atualizações e informações relevantes;</li>\n<li><strong>Segurança:</strong> prevenção de fraudes e atividades suspeitas;</li>\n<li><strong>Melhoria do serviço:</strong> análise de uso para aprimoramento da plataforma.</li>\n</ul>\n\n<h2>3. Base Legal (LGPD)</h2>\n<p>O tratamento de dados pessoais é realizado com base nas seguintes hipóteses legais previstas na Lei Geral de Proteção de Dados (Lei nº 13.709/2018):</p>\n<ul>\n<li><strong>Execução de contrato:</strong> para a prestação do serviço contratado (Art. 7º, V);</li>\n<li><strong>Consentimento:</strong> para finalidades específicas mediante aceite expresso do usuário (Art. 7º, I);</li>\n<li><strong>Legítimo interesse:</strong> para melhoria do serviço e prevenção de fraudes (Art. 7º, IX);</li>\n<li><strong>Cumprimento de obrigação legal:</strong> quando exigido por lei ou regulamentação aplicável (Art. 7º, II).</li>\n</ul>\n\n<h2>4. Compartilhamento de Dados</h2>\n<p>Seus dados pessoais poderão ser compartilhados com:</p>\n<ul>\n<li><strong>Gateways de pagamento:</strong> para processamento seguro de transações financeiras;</li>\n<li><strong>Serviços de hospedagem:</strong> para armazenamento seguro de dados;</li>\n<li><strong>Ferramentas de analytics:</strong> para análise de uso da plataforma (dados anonimizados);</li>\n<li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>\n</ul>\n<p>Não comercializamos, alugamos ou vendemos dados pessoais a terceiros para fins de marketing.</p>\n\n<h2>5. Direitos do Titular</h2>\n<p>Em conformidade com a LGPD, você tem direito a:</p>\n<ul>\n<li><strong>Acesso:</strong> solicitar informações sobre quais dados pessoais tratamos;</li>\n<li><strong>Correção:</strong> solicitar a correção de dados incompletos, inexatos ou desatualizados;</li>\n<li><strong>Exclusão:</strong> solicitar a exclusão de dados pessoais tratados com base no consentimento;</li>\n<li><strong>Portabilidade:</strong> solicitar a transferência de seus dados a outro fornecedor;</li>\n<li><strong>Revogação do consentimento:</strong> retirar o consentimento a qualquer momento;</li>\n<li><strong>Informação:</strong> ser informado sobre o compartilhamento de dados com terceiros.</li>\n</ul>\n<p>Para exercer seus direitos, entre em contato através do e-mail: <strong>privacidade@blazeiptv.com</strong></p>\n\n<h2>6. Segurança dos Dados</h2>\n<p>Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais:</p>\n<ul>\n<li><strong>Criptografia:</strong> dados transmitidos via protocolo HTTPS/TLS;</li>\n<li><strong>Controle de acesso:</strong> acesso restrito a dados pessoais apenas por pessoal autorizado;</li>\n<li><strong>Logs de atividade:</strong> registro e monitoramento de acessos aos sistemas;</li>\n<li><strong>Backups:</strong> cópias de segurança regulares para prevenção de perda de dados.</li>\n</ul>\n\n<h2>7. Cookies</h2>\n<p>Utilizamos os seguintes tipos de cookies:</p>\n<ul>\n<li><strong>Cookies essenciais:</strong> necessários para o funcionamento da plataforma (sessão e autenticação);</li>\n<li><strong>Cookies de performance:</strong> coletam informações sobre como a plataforma é utilizada para fins de melhoria;</li>\n<li><strong>Cookies de funcionalidade:</strong> armazenam preferências do usuário para personalização.</li>\n</ul>\n<p>Você pode gerenciar suas preferências de cookies a qualquer momento através do banner de cookies disponível na plataforma.</p>\n\n<h2>8. Retenção de Dados</h2>\n<p>Os dados pessoais serão mantidos pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo obrigações legais, contratuais e regulatórias.</p>\n\n<h2>9. Alterações na Política</h2>\n<p>Esta Política de Privacidade pode ser atualizada periodicamente. Notificaremos os usuários sobre alterações significativas por e-mail ou através da plataforma.</p>\n\n<h2>10. Encarregado de Proteção de Dados (DPO)</h2>\n<p>Para questões relacionadas à proteção de dados pessoais, entre em contato com nosso Encarregado de Proteção de Dados:</p>\n<p>E-mail: <strong>privacidade@blazeiptv.com</strong></p>\n\n<p><em>Última atualização: Fevereiro de 2026</em></p>', true);
