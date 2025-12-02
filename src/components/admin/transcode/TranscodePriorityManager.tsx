import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowUp, ArrowDown, Zap, Clock, AlertCircle } from 'lucide-react';

interface QueueStats {
  critical: number;
  high: number;
  normal: number;
  low: number;
}

export function TranscodePriorityManager() {
  const { toast } = useToast();
  const [stats, setStats] = useState<QueueStats>({ critical: 0, high: 0, normal: 0, low: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('transcode_jobs')
        .select('priority')
        .eq('status', 'queued');

      if (error) throw error;

      const newStats: QueueStats = {
        critical: data?.filter(j => j.priority === 4).length || 0,
        high: data?.filter(j => j.priority === 3).length || 0,
        normal: data?.filter(j => j.priority === 2).length || 0,
        low: data?.filter(j => j.priority === 1).length || 0,
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const changePriority = async (jobId: string, newPriority: number) => {
    try {
      const { error } = await supabase
        .from('transcode_jobs')
        .update({ priority: newPriority })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: 'Prioridade atualizada',
        description: `Job movido para prioridade ${newPriority}`,
      });

      loadStats();
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar prioridade',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const processHighPriority = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('transcode-runner', {
        body: { priorityFilter: [3, 4], maxJobs: 10 },
      });

      if (error) throw error;

      toast({
        title: 'Processamento iniciado',
        description: `Processando jobs de alta prioridade`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao processar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const total = stats.critical + stats.high + stats.normal + stats.low;
  const criticalPercent = total > 0 ? (stats.critical / total) * 100 : 0;
  const highPercent = total > 0 ? (stats.high / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Gestão de Filas Prioritárias
          </CardTitle>
          <CardDescription>
            Sistema de 4 níveis de prioridade com processamento otimizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card className="border-red-200 bg-red-50 dark:bg-red-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Crítica</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
                <p className="text-xs text-muted-foreground mt-1">Prioridade 4</p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Alta</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.high}</div>
                <p className="text-xs text-muted-foreground mt-1">Prioridade 3</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Normal</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.normal}</div>
                <p className="text-xs text-muted-foreground mt-1">Prioridade 2</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Baixa</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-600">{stats.low}</div>
                <p className="text-xs text-muted-foreground mt-1">Prioridade 1</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Distribuição da Fila</span>
              <span className="text-muted-foreground">{total} jobs total</span>
            </div>
            <div className="space-y-1">
              <div className="flex gap-1 h-4">
                {stats.critical > 0 && (
                  <div 
                    className="bg-red-500 rounded-sm" 
                    style={{ width: `${criticalPercent}%` }}
                    title={`${stats.critical} críticos`}
                  />
                )}
                {stats.high > 0 && (
                  <div 
                    className="bg-orange-500 rounded-sm" 
                    style={{ width: `${highPercent}%` }}
                    title={`${stats.high} alta prioridade`}
                  />
                )}
                {stats.normal > 0 && (
                  <div 
                    className="bg-blue-500 rounded-sm flex-1"
                    title={`${stats.normal} normais`}
                  />
                )}
                {stats.low > 0 && (
                  <div 
                    className="bg-gray-400 rounded-sm flex-1"
                    title={`${stats.low} baixa prioridade`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Crítico ({criticalPercent.toFixed(0)}%)</span>
                <span>Alto ({highPercent.toFixed(0)}%)</span>
                <span>Normal/Baixo ({(100 - criticalPercent - highPercent).toFixed(0)}%)</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={processHighPriority}
              disabled={stats.critical === 0 && stats.high === 0}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              Processar Alta Prioridade
            </Button>
          </div>

          {(stats.critical > 0 || stats.high > 0) && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    {stats.critical + stats.high} jobs de alta prioridade na fila
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Estes jobs serão processados primeiro, respeitando a ordem de prioridade
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
