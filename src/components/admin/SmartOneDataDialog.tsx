import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Dados para SmartOne IPTV
          </DialogTitle>
          <DialogDescription>
            Copie os dados abaixo e cole manualmente no painel SmartOne IPTV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Nome do Cliente */}
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-foreground">Nome do Cliente</Label>
              <CopyButton text={clientData.nome} fieldName="Nome" />
            </div>
            <p className="text-base font-mono bg-background p-2 rounded border border-border">
              {clientData.nome}
            </p>
          </div>

          {/* MAC Address */}
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-foreground">MAC Address</Label>
              <CopyButton text={clientData.macSmartOne} fieldName="MAC Address" />
            </div>
            <p className="text-base font-mono bg-background p-2 rounded border border-border">
              {clientData.macSmartOne}
            </p>
          </div>

          {/* Playlists M3U */}
          {clientData.m3uLists.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <Label className="text-sm font-semibold text-foreground mb-3 block">
                Playlists M3U Selecionadas
              </Label>
              <div className="space-y-3">
                {clientData.m3uLists.map((playlist, index) => (
                  <div key={index} className="bg-background p-3 rounded border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">{playlist.name}</p>
                      <CopyButton text={playlist.file_url} fieldName={`URL - ${playlist.name}`} />
                    </div>
                    <p className="text-xs font-mono text-muted-foreground break-all">
                      {playlist.file_url}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instruções */}
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <h4 className="text-sm font-semibold text-foreground mb-2">📋 Instruções</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse o painel SmartOne IPTV</li>
              <li>Crie ou edite a playlist do cliente</li>
              <li>Cole o MAC Address no campo correspondente</li>
              <li>Cole a URL da playlist M3U no campo de playlist</li>
              <li>Salve as alterações no SmartOne</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
