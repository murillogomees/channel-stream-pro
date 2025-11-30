import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  RotateCcw,
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getCriticalFailures,
  resetUploadForRetry,
  deleteUpload,
  CriticalFailure
} from '@/services/cloudflareStreamService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CloudflareStreamAlertsProps {
  onAlertCountChange?: (count: number) => void;
}

export function CloudflareStreamAlerts({ onAlertCountChange }: CloudflareStreamAlertsProps) {
  const [failures, setFailures] = useState<CriticalFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadFailures = async () => {
    setLoading(true);
    try {
      const data = await getCriticalFailures(3);
      setFailures(data);
      onAlertCountChange?.(data.length);
    } catch (error) {
      console.error('Error loading failures:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFailures();
  }, []);

  const handleReset = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const success = await resetUploadForRetry(id);
      if (success) {
        toast.success('Upload resetado para retry');
        setFailures(prev => prev.filter(f => f.id !== id));
        onAlertCountChange?.(failures.length - 1);
      } else {
        toast.error('Erro ao resetar upload');
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const success = await deleteUpload(id);
      if (success) {
        toast.success('Upload removido');
        setFailures(prev => prev.filter(f => f.id !== id));
        onAlertCountChange?.(failures.length - 1);
      } else {
        toast.error('Erro ao remover upload');
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleResetAll = async () => {
    for (const failure of failures) {
      await handleReset(failure.id);
    }
  };

  const criticalCount = failures.filter(f => f.retry_count >= 5).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <div>
            <h3 className="font-medium">Nenhuma falha crítica</h3>
            <p className="text-sm text-muted-foreground">
              Todos os uploads estão funcionando normalmente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Falhas Críticas
              <Badge variant="destructive" className="text-xs">
                {failures.length}
              </Badge>
              {criticalCount > 0 && (
                <Badge className="bg-red-900 text-red-200 text-xs">
                  {criticalCount} máx. retries
                </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              Uploads com 3+ tentativas falhadas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadFailures}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {failures.length > 0 && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleResetAll}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Resetar Todos
            </Button>
          )}
        </div>
      </div>

      {/* Lista de falhas */}
      <ScrollArea className="h-[350px]">
        <div className="space-y-2">
          {failures.map((failure) => {
            const isProcessing = processingIds.has(failure.id);
            const isCritical = failure.retry_count >= 5;
            
            return (
              <div 
                key={failure.id}
                className={`p-3 rounded-lg border ${
                  isCritical 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {failure.channel_name}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          isCritical ? 'border-red-500 text-red-400' : 'border-yellow-500 text-yellow-400'
                        }`}
                      >
                        {failure.retry_count} retries
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {failure.error_message || 'Erro desconhecido'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Última tentativa: {formatDistanceToNow(new Date(failure.updated_at), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                      onClick={() => handleReset(failure.id)}
                      disabled={isProcessing}
                      title="Resetar para retry"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(failure.id)}
                      disabled={isProcessing}
                      title="Remover permanentemente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default CloudflareStreamAlerts;
