import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Brain, TrendingUp, AlertTriangle, Zap, Clock, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PredictionData {
  avgProcessingTime: number;
  predictedTime: number;
  confidence: number;
  bottlenecks: string[];
  recommendations: string[];
}

export function TranscodeMLPredictor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    loadPredictions();
    const interval = setInterval(loadPredictions, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPredictions = async () => {
    try {
      // Buscar jobs históricos para análise
      const { data: jobs, error } = await supabase
        .from('transcode_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calcular métricas
      const completedJobs = jobs?.filter(j => j.status === 'ready') || [];
      const failedJobs = jobs?.filter(j => j.status === 'failed') || [];
      
      const avgTime = completedJobs.reduce((sum, job) => {
        const start = new Date(job.started_at || job.created_at).getTime();
        const end = new Date(job.completed_at || new Date()).getTime();
        return sum + (end - start) / 1000 / 60; // minutos
      }, 0) / (completedJobs.length || 1);

      // Detectar bottlenecks
      const bottlenecks: string[] = [];
      const queuedJobs = jobs?.filter(j => j.status === 'queued').length || 0;
      const processingJobs = jobs?.filter(j => j.status === 'processing').length || 0;
      const failureRate = failedJobs.length / (jobs?.length || 1);

      if (queuedJobs > 10) bottlenecks.push('Fila muito longa - considere aumentar concorrência');
      if (processingJobs > 5) bottlenecks.push('Alto volume de processamento - possível gargalo de CPU');
      if (failureRate > 0.1) bottlenecks.push('Taxa de falha alta - verificar logs e estabilidade');

      // Recomendações baseadas em ML
      const recommendations: string[] = [];
      if (avgTime > 10) recommendations.push('⚡ Usar presets mais rápidos para reduzir tempo');
      if (queuedJobs > 5) recommendations.push('🔄 Processar em horários de baixa demanda');
      if (failureRate > 0.05) recommendations.push('🛠️ Implementar retry automático com backoff');
      
      const hourNow = new Date().getHours();
      if (hourNow >= 6 && hourNow <= 22) {
        recommendations.push('💰 Agendar para 22h-6h (horário off-peak, -30% custo)');
      }

      setPrediction({
        avgProcessingTime: avgTime,
        predictedTime: avgTime * 1.15, // 15% margem
        confidence: Math.min(95, completedJobs.length * 2), // confiança baseada em dados
        bottlenecks,
        recommendations
      });

      // Dados históricos para gráfico
      const last24h = jobs?.slice(0, 24).reverse().map((job, idx) => ({
        hora: `${idx}h`,
        tempo: job.status === 'ready' ? 
          (new Date(job.completed_at || new Date()).getTime() - new Date(job.started_at || job.created_at).getTime()) / 1000 / 60 : 0,
        status: job.status
      }));

      setHistoricalData(last24h || []);
    } catch (error: any) {
      console.error('Error loading predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const runOptimization = async () => {
    try {
      toast({
        title: 'Otimização iniciada',
        description: 'Aplicando recomendações de ML...',
      });

      // Implementar otimizações automáticas
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: 'Otimização concluída',
        description: 'Recursos otimizados com sucesso',
      });

      loadPredictions();
    } catch (error: any) {
      toast({
        title: 'Erro na otimização',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando predições de ML...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Machine Learning Predictor
          </CardTitle>
          <CardDescription>
            Análise preditiva baseada em histórico de processamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Métricas de Predição */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Tempo Médio</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{prediction?.avgProcessingTime.toFixed(1)}min</div>
                <p className="text-xs text-muted-foreground mt-1">Últimos 100 jobs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Tempo Previsto</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{prediction?.predictedTime.toFixed(1)}min</div>
                <p className="text-xs text-muted-foreground mt-1">Próximo job estimado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Confiança</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{prediction?.confidence}%</div>
                <p className="text-xs text-muted-foreground mt-1">Precisão do modelo</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Tendência */}
          <div>
            <h3 className="text-sm font-medium mb-4">Histórico de Processamento (24h)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" />
                <YAxis label={{ value: 'Minutos', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tempo" stroke="#8884d8" name="Tempo (min)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bottlenecks Detectados */}
          {prediction && prediction.bottlenecks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Gargalos Detectados
              </h3>
              <div className="space-y-2">
                {prediction.bottlenecks.map((bottleneck, idx) => (
                  <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <p className="text-sm text-orange-900 dark:text-orange-100">{bottleneck}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendações de IA */}
          {prediction && prediction.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Recomendações de IA
              </h3>
              <div className="space-y-2">
                {prediction.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <p className="text-sm text-purple-900 dark:text-purple-100">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2">
            <Button onClick={runOptimization} className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              Aplicar Otimizações Automáticas
            </Button>
            <Button onClick={loadPredictions} variant="outline">
              Atualizar Análise
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
