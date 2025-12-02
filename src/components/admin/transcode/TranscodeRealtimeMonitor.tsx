import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Cpu, HardDrive, Network, AlertCircle, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SystemMetrics {
  cpuUsage: number;
  bandwidth: number;
  queueDepth: number;
  activeJobs: number;
  memoryUsage: number;
  timestamp: string;
}

export function TranscodeRealtimeMonitor() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    // Configurar subscription em tempo real
    const channel = supabase
      .channel('transcode_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcode_jobs'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          updateMetrics();
        }
      )
      .subscribe();

    // Atualização periódica
    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // 5 segundos

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const updateMetrics = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('transcode_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const queuedJobs = jobs?.filter(j => j.status === 'queued').length || 0;
      const processingJobs = jobs?.filter(j => j.status === 'processing').length || 0;
      
      // Simular métricas (em produção, viria de um serviço real)
      const cpuUsage = Math.min(95, processingJobs * 15 + Math.random() * 10);
      const bandwidth = processingJobs * 5.5 + Math.random() * 2; // MB/s
      const memoryUsage = Math.min(90, processingJobs * 12 + queuedJobs * 2 + Math.random() * 5);

      const newMetric: SystemMetrics = {
        cpuUsage: Math.round(cpuUsage),
        bandwidth: Math.round(bandwidth * 10) / 10,
        queueDepth: queuedJobs,
        activeJobs: processingJobs,
        memoryUsage: Math.round(memoryUsage),
        timestamp: new Date().toLocaleTimeString()
      };

      setCurrentMetrics(newMetric);
      setMetrics(prev => [...prev.slice(-19), newMetric]); // Últimos 20 pontos

      // Detectar alertas
      const newAlerts: string[] = [];
      if (cpuUsage > 80) newAlerts.push('⚠️ CPU acima de 80% - considere limitar concorrência');
      if (bandwidth > 20) newAlerts.push('📡 Bandwidth alto - possível impacto em custos');
      if (queuedJobs > 15) newAlerts.push('⏱️ Fila muito longa - adicionar capacidade');
      if (memoryUsage > 85) newAlerts.push('💾 Memória crítica - limpar cache');
      
      setAlerts(newAlerts);

      // Toast para alertas críticos
      if (cpuUsage > 90 && alerts.length === 0) {
        toast({
          title: 'Alerta Crítico',
          description: 'CPU acima de 90% - ação imediata necessária',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error updating metrics:', error);
    }
  };

  const getStatusColor = (value: number, thresholds: [number, number]) => {
    if (value < thresholds[0]) return 'text-green-600';
    if (value < thresholds[1]) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Monitoramento em Tempo Real
              </CardTitle>
              <CardDescription>
                Métricas ao vivo do sistema de transcodificação
              </CardDescription>
            </div>
            <Badge variant={isLive ? "default" : "secondary"} className="animate-pulse">
              {isLive ? '🔴 AO VIVO' : '⏸️ Pausado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Métricas em Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">CPU</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(currentMetrics?.cpuUsage || 0, [60, 80])}`}>
                  {currentMetrics?.cpuUsage || 0}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium">Bandwidth</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(currentMetrics?.bandwidth || 0, [10, 20])}`}>
                  {currentMetrics?.bandwidth || 0} MB/s
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-medium">Memória</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(currentMetrics?.memoryUsage || 0, [70, 85])}`}>
                  {currentMetrics?.memoryUsage || 0}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-medium">Fila</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentMetrics?.queueDepth || 0}</div>
                <p className="text-xs text-muted-foreground">jobs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-medium">Ativos</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentMetrics?.activeJobs || 0}</div>
                <p className="text-xs text-muted-foreground">processando</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico em Tempo Real */}
          <div>
            <h3 className="text-sm font-medium mb-4">Histórico em Tempo Real</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cpuUsage" stroke="#3b82f6" name="CPU %" dot={false} />
                <Line type="monotone" dataKey="bandwidth" stroke="#10b981" name="Bandwidth (MB/s)" dot={false} />
                <Line type="monotone" dataKey="queueDepth" stroke="#f59e0b" name="Fila" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Alertas Proativos */}
          {alerts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Alertas de Performance
              </h3>
              <div className="space-y-2">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-900 dark:text-red-100">{alert}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status do Sistema */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Status do Sistema</p>
              <p className="text-xs text-muted-foreground">
                Última atualização: {currentMetrics?.timestamp || 'N/A'}
              </p>
            </div>
            <Badge variant={alerts.length === 0 ? "default" : "destructive"}>
              {alerts.length === 0 ? '✅ Saudável' : `⚠️ ${alerts.length} Alerta(s)`}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
