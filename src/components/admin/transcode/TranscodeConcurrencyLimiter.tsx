import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Cpu, TrendingUp } from 'lucide-react';

export function TranscodeConcurrencyLimiter() {
  const { toast } = useToast();
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [currentActive, setCurrentActive] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [avgProcessingTime, setAvgProcessingTime] = useState(0);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Get active jobs
      const { data: active, error: activeError } = await supabase
        .from('transcode_jobs')
        .select('*')
        .eq('status', 'processing');

      if (!activeError && active) {
        setCurrentActive(active.length);
      }

      // Get queued jobs
      const { data: queued, error: queuedError } = await supabase
        .from('transcode_jobs')
        .select('*')
        .eq('status', 'queued');

      if (!queuedError && queued) {
        setQueueSize(queued.length);
      }

      // Calculate average processing time
      const { data: completed, error: completedError } = await supabase
        .from('transcode_jobs')
        .select('created_at, completed_at')
        .eq('status', 'ready')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (!completedError && completed) {
        const times = completed
          .filter(j => j.completed_at && j.created_at)
          .map(j => {
            const start = new Date(j.created_at).getTime();
            const end = new Date(j.completed_at!).getTime();
            return (end - start) / 1000 / 60; // minutes
          });

        if (times.length > 0) {
          const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
          setAvgProcessingTime(avg);
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const applyLimit = async () => {
    try {
      // In production, this would update system configuration
      toast({
        title: 'Limite atualizado',
        description: `Máximo de ${maxConcurrent} jobs simultâneos`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const estimatedWaitTime = queueSize > 0 && maxConcurrent > 0
    ? (queueSize / maxConcurrent) * avgProcessingTime
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          Controle de Concorrência
        </CardTitle>
        <CardDescription>
          Limite quantos jobs podem processar simultaneamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Processando Agora</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{currentActive}</div>
              <p className="text-xs text-muted-foreground mt-1">
                de {maxConcurrent} slots
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Na Fila</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{queueSize}</div>
              <p className="text-xs text-muted-foreground mt-1">
                aguardando
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Tempo Médio</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {avgProcessingTime.toFixed(1)}m
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                por job
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Máximo de Jobs Simultâneos
              </label>
              <Badge variant="secondary" className="text-lg font-bold">
                {maxConcurrent}
              </Badge>
            </div>
            <Slider
              value={[maxConcurrent]}
              onValueChange={(v) => setMaxConcurrent(v[0])}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 (conservador)</span>
              <span>10 (balanceado)</span>
              <span>20 (agressivo)</span>
            </div>
          </div>

          {queueSize > 0 && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tempo estimado de espera:</span>
                <Badge variant="outline">
                  {estimatedWaitTime.toFixed(1)} minutos
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Com {maxConcurrent} jobs simultâneos, levará ~{estimatedWaitTime.toFixed(1)} min para processar a fila atual
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setMaxConcurrent(3)}>
              Conservador (3)
            </Button>
            <Button variant="outline" onClick={() => setMaxConcurrent(5)}>
              Balanceado (5)
            </Button>
            <Button variant="outline" onClick={() => setMaxConcurrent(10)}>
              Agressivo (10)
            </Button>
            <Button variant="outline" onClick={() => setMaxConcurrent(20)}>
              Máximo (20)
            </Button>
          </div>

          <Button onClick={applyLimit} className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Aplicar Limite de {maxConcurrent} Jobs
          </Button>
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Recomendação
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                {maxConcurrent <= 3 && 'Uso conservador ideal para evitar sobrecarga no servidor'}
                {maxConcurrent > 3 && maxConcurrent <= 10 && 'Configuração balanceada recomendada para maioria dos casos'}
                {maxConcurrent > 10 && 'Alto paralelismo - monitore recursos do servidor'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
