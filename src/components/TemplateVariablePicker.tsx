import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  User,
  CreditCard,
  Wallet,
  Ticket,
  Settings,
  Tv,
  BarChart,
  Edit,
  Search,
  Plus,
  Film,
  Quote,
  Copy,
  Check,
} from 'lucide-react';
import { VARIABLE_CATEGORIES, FAMOUS_QUOTES, TemplateVariable } from '@/constants/templateVariables';
import { toast } from 'sonner';

interface TemplateVariablePickerProps {
  onInsertVariable: (variable: string) => void;
  onInsertQuote?: (quote: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  User: <User className="h-4 w-4" />,
  CreditCard: <CreditCard className="h-4 w-4" />,
  Wallet: <Wallet className="h-4 w-4" />,
  Ticket: <Ticket className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Tv: <Tv className="h-4 w-4" />,
  BarChart: <BarChart className="h-4 w-4" />,
  Edit: <Edit className="h-4 w-4" />,
};

export default function TemplateVariablePicker({ onInsertVariable, onInsertQuote }: TemplateVariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('variables');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [quoteSearch, setQuoteSearch] = useState('');

  const handleInsertVariable = (variable: TemplateVariable) => {
    // Usar formato {variavel} - chave simples (padrão do sistema)
    const varFormat = `{${variable.key}}`;
    onInsertVariable(varFormat);
    setCopiedVariable(variable.key);
    toast.success(`Variável ${varFormat} inserida!`);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const handleInsertQuote = (quote: string) => {
    if (onInsertQuote) {
      onInsertQuote(`"${quote}"`);
    } else {
      onInsertVariable(`"${quote}"`);
    }
    toast.success('Frase inserida no template!');
  };

  const filteredCategories = VARIABLE_CATEGORIES.map(category => ({
    ...category,
    variables: category.variables.filter(
      v =>
        v.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.description.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(category => category.variables.length > 0);

  const filteredQuotes = FAMOUS_QUOTES.filter(
    q =>
      q.quote.toLowerCase().includes(quoteSearch.toLowerCase()) ||
      q.source.toLowerCase().includes(quoteSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Variáveis
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Variáveis e Conteúdo para Templates
          </DialogTitle>
          <DialogDescription>
            Selecione variáveis dinâmicas ou frases famosas para inserir no seu template
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="variables" className="gap-2">
              <Settings className="h-4 w-4" />
              Variáveis ({VARIABLE_CATEGORIES.flatMap(c => c.variables).length})
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2">
              <Film className="h-4 w-4" />
              Frases de Filmes ({FAMOUS_QUOTES.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="variables" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar variáveis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {filteredCategories.map((category) => (
                  <div key={category.id} className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-2 z-10">
                      <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        {iconMap[category.icon]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{category.name}</h4>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto">
                        {category.variables.length}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {category.variables.map((variable) => (
                        <TooltipProvider key={variable.key}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start h-auto py-2 px-3 text-left"
                                onClick={() => handleInsertVariable(variable)}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  {copiedVariable === variable.key ? (
                                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs truncate">{variable.label}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                                      {`{${variable.key}}`}
                                    </p>
                                  </div>
                                </div>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-medium">{variable.label}</p>
                              <p className="text-xs text-muted-foreground">{variable.description}</p>
                              <p className="text-xs mt-1">
                                <span className="text-muted-foreground">Exemplo:</span>{' '}
                                <span className="font-mono">{variable.example}</span>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredCategories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma variável encontrada</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar frases por texto ou filme..."
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredQuotes.map((item, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4 text-left hover:bg-muted/50"
                    onClick={() => handleInsertQuote(item.quote)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Quote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-relaxed">"{item.quote}"</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-5">
                            <Film className="h-3 w-3 mr-1" />
                            {item.source}
                          </Badge>
                          {item.year && (
                            <span className="text-[10px] text-muted-foreground">{item.year}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}

                {filteredQuotes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Film className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma frase encontrada</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                💡 Dica: Use frases famosas para criar mensagens memoráveis e engajar seus clientes!
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
