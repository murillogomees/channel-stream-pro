import { useState } from "react";
import { Plus, Copy, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

interface Snippet {
  id: string;
  title: string;
  content: string;
  category: string;
  variables: string[];
}

interface MessageSnippetsProps {
  onInsert: (text: string) => void;
}

const MessageSnippets = ({ onInsert }: MessageSnippetsProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const snippets: Snippet[] = [
    // Saudações
    {
      id: "saudacao-1",
      title: "Saudação Formal",
      content: "Olá {{nome}}, tudo bem? Esperamos que sim!",
      category: "Saudações",
      variables: ["nome"]
    },
    {
      id: "saudacao-2",
      title: "Saudação Informal",
      content: "Oi {{nome}}! 😊",
      category: "Saudações",
      variables: ["nome"]
    },
    {
      id: "saudacao-3",
      title: "Saudação com Horário",
      content: "Bom dia, {{nome}}! Como você está?",
      category: "Saudações",
      variables: ["nome"]
    },

    // Informações de Vencimento
    {
      id: "vencimento-1",
      title: "Alerta de Vencimento Próximo",
      content: "⚠️ Seu plano {{plano}} vence em {{dias_restantes}} dias ({{data_vencimento}}). Para evitar a interrupção do serviço, renove sua assinatura o quanto antes!",
      category: "Vencimento",
      variables: ["plano", "dias_restantes", "data_vencimento"]
    },
    {
      id: "vencimento-2",
      title: "Vencimento Hoje",
      content: "🔔 Atenção! Seu plano {{plano}} vence HOJE ({{data_vencimento}}). Renove agora para continuar aproveitando nossos serviços sem interrupções!",
      category: "Vencimento",
      variables: ["plano", "data_vencimento"]
    },
    {
      id: "vencimento-3",
      title: "Plano Vencido",
      content: "❌ Seu plano {{plano}} venceu há {{dias_vencido}} dias. Para reativar seu acesso, renove sua assinatura o quanto antes!",
      category: "Vencimento",
      variables: ["plano", "dias_vencido"]
    },

    // Informações de Pagamento
    {
      id: "pagamento-1",
      title: "Valor e PIX",
      content: "💰 Valor da renovação: R$ {{valor}}\n\n🔑 Chave PIX: {{chave_pix}}",
      category: "Pagamento",
      variables: ["valor", "chave_pix"]
    },
    {
      id: "pagamento-2",
      title: "Link de Pagamento",
      content: "Para facilitar, você pode pagar através do link:\n🔗 {{link_pagamento}}",
      category: "Pagamento",
      variables: ["link_pagamento"]
    },
    {
      id: "pagamento-3",
      title: "Instruções PIX Completas",
      content: "📱 Como pagar:\n1. Abra o app do seu banco\n2. Escolha PIX\n3. Cole a chave: {{chave_pix}}\n4. Confirme o valor: R$ {{valor}}\n5. Finalize o pagamento",
      category: "Pagamento",
      variables: ["chave_pix", "valor"]
    },
    {
      id: "pagamento-4",
      title: "Confirmação Recebida",
      content: "✅ Pagamento confirmado!\nValor: R$ {{valor}}\nMétodo: {{metodo_pagamento}}\nData: {{data_atual}}",
      category: "Pagamento",
      variables: ["valor", "metodo_pagamento", "data_atual"]
    },

    // Boas-vindas
    {
      id: "boasvindas-1",
      title: "Boas-vindas Período de Teste",
      content: "🎉 Bem-vindo à {{empresa_nome}}!\n\nParabéns por ativar seu período de teste de {{duracao}}! Durante este período, você terá acesso completo a todos os recursos do plano {{plano}}.",
      category: "Boas-vindas",
      variables: ["empresa_nome", "duracao", "plano"]
    },
    {
      id: "boasvindas-2",
      title: "Boas-vindas Plano Pago",
      content: "🎊 Seja muito bem-vindo à {{empresa_nome}}!\n\nSeu plano {{plano}} foi ativado com sucesso! Aproveite mais de 10.000 canais em Full HD e 4K.",
      category: "Boas-vindas",
      variables: ["empresa_nome", "plano"]
    },
    {
      id: "boasvindas-3",
      title: "Instruções Iniciais",
      content: "📺 Como começar:\n1. Abra o app IPTV na sua TV\n2. Faça login com seu email: {{email}}\n3. Aproveite nosso conteúdo!\n\nDúvidas? Entre em contato: {{empresa_telefone}}",
      category: "Boas-vindas",
      variables: ["email", "empresa_telefone"]
    },

    // Suporte e Contato
    {
      id: "suporte-1",
      title: "Informações de Contato",
      content: "📞 Precisa de ajuda?\n\nWhatsApp: {{empresa_telefone}}\nEmail: {{empresa_email}}\n\nEstamos à disposição!",
      category: "Suporte",
      variables: ["empresa_telefone", "empresa_email"]
    },
    {
      id: "suporte-2",
      title: "Horário de Atendimento",
      content: "⏰ Horário de atendimento:\nSegunda a Sexta: 8h às 18h\nSábado: 9h às 13h\n\nContato: {{empresa_telefone}}",
      category: "Suporte",
      variables: ["empresa_telefone"]
    },

    // Despedida
    {
      id: "despedida-1",
      title: "Despedida Formal",
      content: "Atenciosamente,\nEquipe {{empresa_nome}}",
      category: "Despedida",
      variables: ["empresa_nome"]
    },
    {
      id: "despedida-2",
      title: "Despedida com Agradecimento",
      content: "Agradecemos pela preferência! 💙\n\n{{empresa_nome}} - Sua diversão sem limites!",
      category: "Despedida",
      variables: ["empresa_nome"]
    },
    {
      id: "despedida-3",
      title: "Call to Action",
      content: "Não perca tempo! Renove agora e continue aproveitando o melhor do entretenimento! 🎬🍿",
      category: "Despedida",
      variables: []
    },

    // Promoções
    {
      id: "promo-1",
      title: "Desconto para Renovação",
      content: "🎁 OFERTA ESPECIAL!\nRenove hoje e ganhe 10% de desconto!\nDe R$ {{valor}} por apenas R$ [VALOR_COM_DESCONTO]",
      category: "Promoções",
      variables: ["valor"]
    },
    {
      id: "promo-2",
      title: "Indique e Ganhe",
      content: "👥 Programa Indique e Ganhe!\n\nIndique um amigo e ganhe 1 mês GRÁTIS quando ele assinar!\n\nCompartilhe nossa qualidade! 🌟",
      category: "Promoções",
      variables: []
    }
  ];

  const categories = Array.from(new Set(snippets.map(s => s.category)));

  const handleInsert = (snippet: Snippet) => {
    onInsert(snippet.content);
    toast.success(`Snippet "${snippet.title}" inserido!`);
  };

  const handleCopy = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.content);
    setCopiedId(snippet.id);
    toast.success("Snippet copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">📝</span>
          Biblioteca de Snippets
        </CardTitle>
        <CardDescription>
          Clique para inserir trechos prontos na sua mensagem
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <Accordion type="single" collapsible className="w-full">
            {categories.map((category) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="text-sm font-semibold">
                  {category}
                  <Badge variant="secondary" className="ml-2">
                    {snippets.filter(s => s.category === category).length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {snippets
                      .filter(s => s.category === category)
                      .map((snippet) => (
                        <div
                          key={snippet.id}
                          className="border rounded-lg p-3 space-y-2 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{snippet.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                {snippet.content}
                              </p>
                            </div>
                          </div>
                          
                          {snippet.variables.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {snippet.variables.map((variable) => (
                                <Badge key={variable} variant="outline" className="text-xs">
                                  {`{{${variable}}}`}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1"
                              onClick={() => handleInsert(snippet)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Inserir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(snippet)}
                            >
                              {copiedId === snippet.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default MessageSnippets;
