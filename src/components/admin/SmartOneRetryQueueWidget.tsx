import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { smartoneRetryQueueService } from '@/services/smartoneRetryQueueService';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RetryQueueStats {
  total: number;
  pending: number;
  retrying: number;
  exhausted: number;
  succeeded: number;
}

export function SmartOneRetryQueueWidget() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<RetryQueueStats>({
    total: 0,
    pending: 0,
    retrying: 0,
    exhausted: 0,
    succeeded: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadStats = async () => {
    try {
      const data = await smartoneRetryQueueService.getStats();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Error loading retry queue stats:', error);
    }
  };

  useEffect(() => {
    loadStats();

    // Real-time subscription
    const channel = supabase
      .channel('retry-queue-widget')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'smartone_sync_retry_queue'
        },
        () => {
          console.log('🔄 Retry queue updated');
          loadStats();
        }
      )
      .subscribe();

    // Periodic refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const result = await smartoneRetryQueueService.processQueue();
      
      toast({
        title: 'Fila processada',
        description: `${result.processed} itens processados: ${result.succeeded} sucesso, ${result.failed} falhas`,
      });
      
      await loadStats();
    } catch (error: any) {
      toast({
        title: 'Erro ao processar fila',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getPendingPercentage = () => {
    if (stats.total === 0) return 0;
    return Math.round(((stats.pending + stats.retrying) / stats.total) * 100);
  };

  const getSuccessRate = () => {
    const processed = stats.succeeded + stats.exhausted;
    if (processed === 0) return 0;
    return Math.round((stats.succeeded / processed) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5" />
              Fila de Retry SmartOne
              <Badge variant="outline" className="text-xs">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1" />
                Ao vivo
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span className="text-xs">
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </span>
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/smartone-retry-queue')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20">
            <Clock className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.retrying}</p>
              <p className="text-xs text-muted-foreground">Processando</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.succeeded}</p>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20">
            <XCircle className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.exhausted}</p>
              <p className="text-xs text-muted-foreground">Esgotados</p>
            </div>
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Itens pendentes</span>
            <span className="font-semibold">{getPendingPercentage()}%</span>
          </div>
          <Progress value={getPendingPercentage()} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Taxa de sucesso</span>
            <span className="font-semibold">{getSuccessRate()}%</span>
          </div>
          <Progress 
            value={getSuccessRate()} 
            className="h-2"
          />
        </div>

        {/* Alerts */}
        {stats.exhausted > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.exhausted} sync(s) falharam após todas as tentativas</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleProcessQueue}
            disabled={isProcessing || (stats.pending + stats.retrying) === 0}
            size="sm"
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Processando...' : 'Processar Agora'}
          </Button>
          
          <Button
            onClick={() => navigate('/admin/smartone-retry-queue')}
            variant="outline"
            size="sm"
          >
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
