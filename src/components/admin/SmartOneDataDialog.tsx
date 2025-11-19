import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SMARTONE_PANEL_URL = 'https://smartone-iptv.com/plugin/smart_one/client_main/index/';

interface SmartOneDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientData: {
    nome: string;
    macSmartOne: string;
    m3uLists: Array<{ name: string; file_url: string }>;
  };
}

export function SmartOneDataDialog({ open, onOpenChange, clientData }: SmartOneDataDialogProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast({
        title: 'Copiado!',
        description: `${fieldName} copiado para a área de transferência`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar para a área de transferência',
        variant: 'destructive',
      });
    }
  };

  const CopyButton = ({ text, fieldName }: { text: string; fieldName: string }) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => copyToClipboard(text, fieldName)}
      className="ml-2"
    >
      {copiedField === fieldName ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  const openSmartOnePanel = () => {
    window.open(SMARTONE_PANEL_URL, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ExternalLink className="h-6 w-6 text-primary" />
            Cadastrar Cliente no SmartOne IPTV
          </DialogTitle>
          <DialogDescription className="text-base">
            Siga o passo a passo abaixo para cadastrar este cliente no painel SmartOne IPTV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Passo 1: Acessar Painel */}
          <div className="bg-primary/5 p-5 rounded-lg border-2 border-primary/20">
            <div className="flex items-start gap-3 mb-3">
              <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">Acesse o Painel SmartOne IPTV</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Clique no botão abaixo para abrir o painel de administração do SmartOne em uma nova aba
                </p>
                <Button
                  onClick={openSmartOnePanel}
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Abrir Painel SmartOne IPTV
                </Button>
              </div>
            </div>
          </div>

          {/* Passo 2: Dados do Cliente */}
          <div className="bg-muted/30 p-5 rounded-lg border-2 border-border">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-secondary text-secondary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Copie os Dados do Cliente</h3>
                <p className="text-sm text-muted-foreground">
                  Use os botões de copiar para facilitar o preenchimento no painel SmartOne
                </p>
              </div>
            </div>

            <div className="space-y-4 ml-11">
              {/* Nome do Cliente */}
              <div className="bg-background p-4 rounded-lg border-2 border-border">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">Campo 1</span>
                    Nome do Cliente
                  </Label>
                  <CopyButton text={clientData.nome} fieldName="Nome" />
                </div>
                <p className="text-base font-mono bg-muted/50 p-3 rounded border border-border">
                  {clientData.nome}
                </p>
              </div>

              {/* MAC Address */}
              <div className="bg-background p-4 rounded-lg border-2 border-border">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">Campo 2</span>
                    MAC Address
                  </Label>
                  <CopyButton text={clientData.macSmartOne} fieldName="MAC Address" />
                </div>
                <p className="text-base font-mono bg-muted/50 p-3 rounded border border-border">
                  {clientData.macSmartOne}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ Atenção: O MAC Address deve ser único no SmartOne
                </p>
              </div>

              {/* Playlists M3U */}
              {clientData.m3uLists.length > 0 && (
                <div className="bg-background p-4 rounded-lg border-2 border-border">
                  <Label className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">Campo 3</span>
                    URL da Playlist M3U
                  </Label>
                  <div className="space-y-3">
                    {clientData.m3uLists.map((playlist, index) => (
                      <div key={index} className="bg-muted/50 p-3 rounded border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-foreground">{playlist.name}</p>
                          <CopyButton text={playlist.file_url} fieldName={`URL - ${playlist.name}`} />
                        </div>
                        <p className="text-xs font-mono text-muted-foreground break-all bg-background p-2 rounded">
                          {playlist.file_url}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Passo 3: Instruções Finais */}
          <div className="bg-accent/10 p-5 rounded-lg border-2 border-accent/20">
            <div className="flex items-start gap-3">
              <div className="bg-accent text-accent-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">Cole os Dados no SmartOne</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>No painel SmartOne, clique em <strong>"Adicionar Nova Playlist"</strong> ou <strong>"Editar Playlist"</strong></li>
                  <li>Cole o <strong>Nome do Cliente</strong> no campo de nome</li>
                  <li>Cole o <strong>MAC Address</strong> no campo correspondente</li>
                  <li>Cole a <strong>URL da Playlist M3U</strong> no campo de URL/Link</li>
                  <li>Clique em <strong>"Salvar"</strong> para finalizar o cadastro</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Dica Importante */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
            <div className="flex gap-3">
              <div className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">💡 Dica Importante</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Mantenha este diálogo aberto enquanto preenche o painel SmartOne para facilitar a cópia dos dados. 
                  Você pode copiar cada campo individualmente clicando nos botões de copiar.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="flex justify-between items-center gap-3 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={openSmartOnePanel}
            className="flex-1"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir SmartOne Novamente
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Concluído
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
