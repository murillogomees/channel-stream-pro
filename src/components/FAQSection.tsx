import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const FAQSection = () => {
  const faqs = [
    {
      question: "Como funciona o período de teste grátis?",
      answer: "Você tem direito a 15 dias de teste grátis em qualquer plano. Durante esse período, você terá acesso completo a todos os 10.000+ canais, filmes e séries em Full HD e 4K. Não é necessário cadastrar cartão de crédito para o teste."
    },
    {
      question: "Quais são as formas de pagamento aceitas?",
      answer: "Aceitamos PIX (aprovação instantânea), transferência bancária (TED), boleto bancário, cartão de crédito e cartão de débito. O PIX é a forma mais rápida de ativar sua assinatura."
    },
    {
      question: "Posso cancelar minha assinatura a qualquer momento?",
      answer: "Sim! Não há contrato de fidelidade. Você pode cancelar sua assinatura a qualquer momento sem multas ou taxas adicionais. Basta entrar em contato com nosso suporte via WhatsApp."
    },
    {
      question: "Qual a diferença entre os planos?",
      answer: "Todos os planos incluem acesso completo a mais de 10.000 canais em Full HD e 4K. A diferença está no período de assinatura e na economia: quanto maior o período contratado, maior o desconto. Por exemplo, o plano anual oferece 22.3% de economia comparado ao pagamento mensal."
    },
    {
      question: "Quantos dispositivos posso usar simultaneamente?",
      answer: "Sua assinatura permite uso em múltiplos dispositivos da sua residência, incluindo Smart TVs, tablets, smartphones (Android/iOS), computadores e notebooks. Consulte nosso suporte para detalhes específicos do seu plano."
    },
    {
      question: "Como faço para instalar o aplicativo?",
      answer: "O processo é simples: baixe o app SmartOne IPTV na loja de aplicativos do seu dispositivo, instale, acesse as configurações e localize o endereço MAC. Envie-nos o MAC via WhatsApp e configuraremos sua conta. Temos um tutorial completo passo a passo disponível."
    },
    {
      question: "Os canais funcionam em qualidade HD e 4K?",
      answer: "Sim! Oferecemos transmissão em Full HD e 4K (quando disponível), garantindo a melhor qualidade de imagem. A qualidade final depende também da sua conexão de internet - recomendamos no mínimo 10 Mbps para HD e 25 Mbps para 4K."
    },
    {
      question: "Preciso de internet para assistir?",
      answer: "Sim, o serviço IPTV funciona através da internet. Recomendamos uma conexão estável de pelo menos 10 Mbps para assistir em HD e 25 Mbps para 4K. Quanto melhor sua internet, melhor será a qualidade da transmissão."
    },
    {
      question: "Posso assistir em qualquer lugar do mundo?",
      answer: "Sim! Você pode acessar sua conta de qualquer lugar com conexão à internet. Todos os canais e conteúdos estarão disponíveis independente da sua localização geográfica."
    },
    {
      question: "Como funciona o suporte técnico?",
      answer: "Oferecemos suporte 24/7 via WhatsApp para todos os planos. Planos trimestrais, semestrais e anuais têm atendimento prioritário. Nossa equipe está sempre disponível para ajudar com instalação, configuração e dúvidas."
    },
    {
      question: "O que acontece quando minha assinatura vence?",
      answer: "Você receberá notificações por WhatsApp 5 dias antes do vencimento. Após o vencimento, você tem até 5 dias para renovar antes do serviço ser suspenso. A renovação é simples e pode ser feita via WhatsApp."
    },
    {
      question: "Posso mudar de plano depois?",
      answer: "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. Entre em contato via WhatsApp e nossa equipe fará o ajuste, considerando o período já pago da sua assinatura atual."
    }
  ];

  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-card to-background">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Perguntas Frequentes
            </h2>
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Tire suas dúvidas sobre planos, pagamento e funcionamento do serviço
          </p>
        </div>

        {/* FAQ Accordion */}
        <Card className="bg-gradient-card border-2 border-border p-6">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-border">
                <AccordionTrigger className="text-left hover:text-primary transition-colors">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        {/* Contact CTA */}
        <div className="text-center mt-8 p-6 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-lg mb-4">
            Não encontrou a resposta que procurava?
          </p>
          <a
            href="https://wa.me/556131425880?text=Olá!+Tenho+uma+dúvida+sobre+os+planos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Fale Conosco no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
