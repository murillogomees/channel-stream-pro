/**
 * ObservabilityRealtime - Real-time metrics visualization with WebSocket
 */

import { useState, useEffect } from "react";
import { useRealtimeObservability } from "@/hooks/useRealtimeObservability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wifi, WifiOff, RefreshCw, Trash2, Activity, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ObservabilityRealtime() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const {
    isConnected,
    connectionError,
    realtimeMetrics,
    fetchHistory,
    getAggregatedMetrics,
    clearRealtimeMetrics
  } = useRealtimeObservability({
    enabled: true,
    onNewMetric: (metric) => {
      console.log('[UI] New metric:', metric.metric_name, metric.metric_value);
    }
  });

  // Fetch history on mount and time range change
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      const data = await fetchHistory(timeRange);
      setHistoryData(data);
      setIsLoadingHistory(false);
    };
    loadHistory();
  }, [timeRange, fetchHistory]);

  // Prepare chart data
  const latencyData = getAggregatedMetrics(historyData, 'api_latency', timeRange === '1h' ? 'minute' : 'hour');
  const viewsData = getAggregatedMetrics(historyData, 'views', timeRange === '1h' ? 'minute' : 'hour');
  const errorsData = getAggregatedMetrics(historyData, 'errors', timeRange === '1h' ? 'minute' : 'hour');

  const refreshHistory = async () => {
    setIsLoadingHistory(true);
    const data = await fetchHistory(timeRange);
    setHistoryData(data);
    setIsLoadingHistory(false);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-1">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Desconectado
              </>
            )}
          </Badge>
          {connectionError && (
            <span className="text-sm text-destructive">{connectionError}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Última hora</SelectItem>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={refreshHistory} disabled={isLoadingHistory}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Latência da API</CardTitle>
            <CardDescription>Tempo de resposta médio (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                    name="Latência (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Views Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Visualizações</CardTitle>
            <CardDescription>Número de views por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={viewsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                    name="Views"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Errors Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Taxa de Erros</CardTitle>
            <CardDescription>Erros por período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={errorsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={false}
                    name="Erros"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Live Feed */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500 animate-pulse" />
                Feed em Tempo Real
              </CardTitle>
              <CardDescription>Últimas {realtimeMetrics.length} métricas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={clearRealtimeMetrics}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {realtimeMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2" />
                  <p className="text-sm">Aguardando novas métricas...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {realtimeMetrics.map((metric) => (
                    <div 
                      key={metric.id} 
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {metric.metric_type}
                        </Badge>
                        <span className="font-medium">{metric.metric_name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-primary">
                          {typeof metric.metric_value === 'number' 
                            ? metric.metric_value.toFixed(2) 
                            : metric.metric_value}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(metric.recorded_at), 'HH:mm:ss', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">
                {historyData.length}
              </div>
              <div className="text-sm text-muted-foreground">Total de Métricas</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">
                {latencyData.length > 0 
                  ? (latencyData.reduce((a, b) => a + b.value, 0) / latencyData.length).toFixed(0)
                  : '0'} ms
              </div>
              <div className="text-sm text-muted-foreground">Latência Média</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">
                {viewsData.reduce((a, b) => a + b.count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total de Views</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-destructive">
                {errorsData.reduce((a, b) => a + b.count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total de Erros</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
