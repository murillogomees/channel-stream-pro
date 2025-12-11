import { Eye, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TemplatePreviewProps {
  message: string;
  variables?: Record<string, string>;
}

/**
 * Preview de template de mensagem WhatsApp
 * Formato padrão de variáveis: {variavel} (chave simples)
 * Compatibilidade: {{variavel}} também é suportado
 */
const TemplatePreview = ({ message, variables }: TemplatePreviewProps) => {
  // Dados de exemplo padrão
  const defaultExampleData: Record<string, string> = {
    nome: 'João Silva',
    email: 'joao.silva@email.com',
    telefone: '(61) 99697-5924',
    celular: '(61) 99697-5924',
    plano: 'Premium Mensal',
    valor: '49,90',
    duracao: '30 dias',
    dataVencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    dataContratacao: new Date().toLocaleDateString('pt-BR'),
    data_contratacao: new Date().toLocaleDateString('pt-BR'),
    dataFimTeste: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    diasAteVencimento: '3',
    dias_restantes: '3',
    dias_vencido: '0',
    linkPagamento: 'https://iptvlink.com.br/pagar/abc123',
    link_pagamento: 'https://iptvlink.com.br/pagar/abc123',
    whatsappSuporte: '(61) 99697-5924',
    empresaNome: 'IPTV LINK',
    empresa_nome: 'IPTV LINK',
    empresa_telefone: '(61) 99697-5924',
    empresa_email: 'contato@iptvlink.com.br',
    formaPagamento: 'PIX',
    metodo_pagamento: 'PIX',
    statusInfo: 'Aguardando confirmação do pagamento',
    motivoErro: 'Saldo insuficiente',
    planoAnterior: 'Mensal',
    novoPlano: 'Anual',
    totalCanais: '1.500+',
    totalFilmes: '5.000+',
    totalSeries: '2.000+',
    linkApp: 'https://app.iptvlink.com',
    nomeIndicado: 'Maria Santos',
    planoIndicado: 'Trimestral',
    totalIndicacoes: '5',
    indicacoesConvertidas: '3',
    comissaoTotal: '45,00',
    comissaoPendente: '30,00',
    linkIndicacao: 'https://app.iptvlink.com/ref/joao123',
    mesesComoCliente: '6',
    pontosFidelidade: '600',
    nivelFidelidade: 'Prata',
    proximaRecompensa: '1 mês grátis',
    economiaTotal: 'R$ 120,00',
    descontoCupom: '20%',
    codigoCupom: 'PROMO20',
    validadeCupom: '31/12/2024',
    mensagemEspecial: 'Feliz Natal!',
    conteudoEmDestaque: 'Novo filme: Avatar 3',
    novosConteudos: '50 novos filmes e séries',
    dataPersonalizada: '20/12/2024',
    horaAtual: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    textoPersonalizado1: 'Sua mensagem personalizada aqui.',
    textoPersonalizado2: 'Continue escrevendo aqui.',
    chave_pix: 'pix@iptvlink.com.br',
    data_atual: new Date().toLocaleDateString('pt-BR'),
    data_proxima_cobranca: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
  };

  const exampleData = { ...defaultExampleData, ...variables };

  // Substituir variáveis na mensagem
  const getPreviewMessage = () => {
    if (!message) return 'Digite uma mensagem para ver o preview...';
    
    let preview = message;
    
    // Substituir variáveis no formato {variavel} (padrão)
    Object.entries(exampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      preview = preview.replace(regex, value);
    });
    
    // Substituir variáveis no formato {{variavel}} (legado/compatibilidade)
    Object.entries(exampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(regex, value);
    });
    
    return preview;
  };

  // Detectar variáveis não substituídas
  const getUnresolvedVariables = () => {
    const preview = getPreviewMessage();
    const matches = preview.match(/\{+[^}]+\}+/g) || [];
    return matches.map(m => m.replace(/[{}]/g, ''));
  };

  const previewText = getPreviewMessage();
  const unresolvedVars = getUnresolvedVariables();

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Preview em Tempo Real</CardTitle>
        </div>
        <CardDescription>
          Veja como a mensagem ficará com dados reais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WhatsApp Style Preview */}
        <div className="relative">
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                    IPTV LINK
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bg-white dark:bg-card p-3 rounded-lg shadow-sm border">
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {previewText}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Indicador de mensagem WhatsApp */}
          <div className="absolute -bottom-2 right-4 flex items-center gap-1 bg-green-600 dark:bg-green-700 text-white text-xs px-2 py-1 rounded-full shadow-lg">
            <MessageSquare className="h-3 w-3" />
            <span>WhatsApp</span>
          </div>
        </div>

        {/* Variáveis não resolvidas */}
        {unresolvedVars.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ Variáveis não encontradas:
            </p>
            <div className="flex flex-wrap gap-1">
              {unresolvedVars.map((varName, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700">
                  {varName}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              Estas variáveis não possuem dados de exemplo configurados
            </p>
          </div>
        )}

        {/* Formato de variáveis */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            📝 Formato de variáveis:
          </p>
          <div className="flex items-center gap-2 text-xs">
            <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono">{'{variavel}'}</code>
            <span className="text-muted-foreground">→ será substituído pelo valor real do cliente</span>
          </div>
        </div>

        {/* Dados de exemplo usados */}
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            📊 Dados de exemplo utilizados:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(exampleData).slice(0, 6).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
                <code className="text-primary font-mono">{`{${key}}`}</code>
                <span className="text-muted-foreground">→</span>
                <span className="truncate">{value}</span>
              </div>
            ))}
          </div>
          {Object.keys(exampleData).length > 6 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              +{Object.keys(exampleData).length - 6} variáveis disponíveis
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TemplatePreview;
