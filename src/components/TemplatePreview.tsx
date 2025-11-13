import { Eye, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TemplatePreviewProps {
  message: string;
  variables?: Record<string, string>;
}

const TemplatePreview = ({ message, variables }: TemplatePreviewProps) => {
  // Dados de exemplo padrão
  const defaultExampleData: Record<string, string> = {
    nome: 'João Silva',
    email: 'joao.silva@email.com',
    celular: '(61) 99697-5924',
    plano: 'Premium Mensal',
    valor: 'R$ 49,90',
    duracao: '30 dias',
    data_vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    data_proxima_cobranca: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    dias_restantes: '3',
    dias_vencido: '0',
    chave_pix: 'pix@iptvlink.com.br',
    link_pagamento: 'https://iptvlink.com.br/pagar/abc123',
    metodo_pagamento: 'PIX',
    data_atual: new Date().toLocaleDateString('pt-BR'),
    empresa_nome: 'IPTV LINK',
    empresa_telefone: '(61) 99697-5924',
    empresa_email: 'contato@iptvlink.com.br',
    // Variáveis antigas (compatibilidade)
    dataVencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    linkPagamento: 'https://iptvlink.com.br/pagar/abc123',
    telefone: '(61) 99697-5924',
  };

  const exampleData = { ...defaultExampleData, ...variables };

  // Substituir variáveis na mensagem
  const getPreviewMessage = () => {
    if (!message) return 'Digite uma mensagem para ver o preview...';
    
    let preview = message;
    
    // Substituir variáveis no formato {{variavel}}
    Object.entries(exampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(regex, value);
    });
    
    // Substituir variáveis no formato {variavel} (compatibilidade)
    Object.entries(exampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      preview = preview.replace(regex, value);
    });
    
    return preview;
  };

  // Detectar variáveis não substituídas
  const getUnresolvedVariables = () => {
    const preview = getPreviewMessage();
    const matches = preview.match(/\{\{?[^}]+\}?\}/g) || [];
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

        {/* Dados de exemplo usados */}
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            📊 Dados de exemplo utilizados:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(exampleData).slice(0, 6).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
                <code className="text-primary">{`{{${key}}}`}</code>
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
