import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles, Loader2, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, Trash2, Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CleanStats {
  totalEntries: number;
  validEntries: number;
  duplicatesRemoved: number;
  invalidUrlsRemoved: number;
  emptyTitlesRemoved: number;
  processingTimeMs: number;
  quarantined: Array<{ title: string; url: string; reason: string }>;
}

interface CleanSyncEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
  entriesCount: number;
  onCleanComplete?: () => void;
}

export function CleanSyncEntriesDialog({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  entriesCount,
  onCleanComplete,
}: CleanSyncEntriesDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [stats, setStats] = useState<CleanStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setStats(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        `clean-sync-entries?sourceId=${sourceId}&apply=false`
      );

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setStats(data.stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar';
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        `clean-sync-entries?sourceId=${sourceId}&apply=true`
      );

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setStats(data.stats);
      toast.success(`Limpeza aplicada: ${data.stats.validEntries.toLocaleString()} entradas válidas mantidas`);
      
      if (onCleanComplete) {
        onCleanComplete();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao aplicar limpeza';
      setError(message);
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setStats(null);
    setError(null);
    onOpenChange(false);
  };

  const totalRemoved = stats
    ? stats.duplicatesRemoved + stats.invalidUrlsRemoved + stats.emptyTitlesRemoved
    : 0;

  const approvalRate = stats && stats.totalEntries > 0
    ? ((stats.validEntries / stats.totalEntries) * 100).toFixed(1)
    : '0';

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'duplicate': 'Duplicado',
      'invalid-url': 'URL inválida',
      'empty-title': 'Título vazio',
    };
    return labels[reason] || reason;
  };

  const groupQuarantineByReason = (quarantined: CleanStats['quarantined']) => {
    return quarantined.reduce((acc, item) => {
      if (!acc[item.reason]) acc[item.reason] = [];
      acc[item.reason].push(item);
      return acc;
    }, {} as Record<string, typeof quarantined>);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Limpar Entradas Sincronizadas
          </DialogTitle>
          <DialogDescription>
            Analise e remova entradas duplicadas, URLs inválidas e títulos vazios de <strong>{sourceName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Info */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <div className="font-medium">{sourceName}</div>
              <div className="text-sm text-muted-foreground">
                {entriesCount.toLocaleString()} entradas
              </div>
            </div>
            <Badge variant="outline">Sincronizado</Badge>
          </div>

          {/* Analysis Button */}
          {!stats && !isAnalyzing && (
            <Button onClick={handleAnalyze} className="w-full gap-2">
              <Eye className="w-4 h-4" />
              Analisar Entradas
            </Button>
          )}

          {/* Loading */}
          {isAnalyzing && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <div className="text-sm text-muted-foreground">
                Analisando {entriesCount.toLocaleString()} entradas...
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          {stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Total"
                  value={stats.totalEntries}
                  icon={<Sparkles className="w-4 h-4 text-muted-foreground" />}
                />
                <StatCard
                  label="Válidas"
                  value={stats.validEntries}
                  icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                  variant="success"
                />
                <StatCard
                  label="Duplicadas"
                  value={stats.duplicatesRemoved}
                  icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  variant="warning"
                />
                <StatCard
                  label="Inválidas"
                  value={stats.invalidUrlsRemoved + stats.emptyTitlesRemoved}
                  icon={<XCircle className="w-4 h-4 text-red-500" />}
                  variant="danger"
                />
              </div>

              {/* Approval Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Taxa de aprovação</span>
                  <span className="font-medium">{approvalRate}%</span>
                </div>
                <Progress value={parseFloat(approvalRate)} className="h-2" />
              </div>

              {/* Quarantine Details */}
              {stats.quarantined.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Detalhes ({totalRemoved} itens)
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-[200px] mt-2 rounded-md border p-2">
                      <div className="space-y-2">
                        {Object.entries(groupQuarantineByReason(stats.quarantined)).map(([reason, items]) => (
                          <div key={reason} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getReasonLabel(reason)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{items.length} itens</span>
                            </div>
                            {items.slice(0, 5).map((item, i) => (
                              <div key={i} className="text-xs text-muted-foreground pl-4 truncate">
                                {item.title || item.url}
                              </div>
                            ))}
                            {items.length > 5 && (
                              <div className="text-xs text-muted-foreground pl-4">
                                ... e mais {items.length - 5} itens
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Processing Time */}
              <div className="text-xs text-muted-foreground text-center">
                Processado em {(stats.processingTimeMs / 1000).toFixed(2)}s
              </div>

              {/* Apply Button */}
              {totalRemoved > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Confirmar limpeza</AlertTitle>
                  <AlertDescription>
                    {totalRemoved.toLocaleString()} entradas serão removidas permanentemente.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          {stats && totalRemoved > 0 && (
            <Button
              onClick={handleApply}
              disabled={isApplying}
              variant="destructive"
              className="gap-2"
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Aplicar Limpeza
            </Button>
          )}
          {stats && totalRemoved === 0 && (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Nenhuma limpeza necessária
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  variant = 'default' 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variants = {
    default: 'bg-muted/50',
    success: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    danger: 'bg-red-500/10 border-red-500/20',
  };

  return (
    <div className={`flex flex-col items-center p-3 rounded-lg border ${variants[variant]}`}>
      {icon}
      <span className="text-xl font-bold mt-1">{value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
