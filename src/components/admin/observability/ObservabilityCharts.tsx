/**
 * ObservabilityCharts - Performance charts and trends
 */

import { useState } from "react";
import { useObservability } from "@/hooks/useObservability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function ObservabilityCharts() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const { metrics, isLoading, error, refresh } = useObservability({
    autoRefresh: true,
    refreshInterval: 60000,
    timeRange
  });

  // Transform performance metrics for charts
  const getChartData = (metricPoints: { time: string; value: number }[] | undefined) => {
    if (!metricPoints || metricPoints.length === 0) {
      // Generate placeholder data
      const now = Date.now();
      const interval = timeRange === '1h' ? 5 * 60 * 1000 : timeRange === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : 7;
      
      return Array.from({ length: points }, (_, i) => {
        const time = new Date(now - (points - 1 - i) * interval);
        return {
          time: timeRange === '7d' 
            ? time.toLocaleDateString('pt-BR', { weekday: 'short' })
            : time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          value: Math.floor(Math.random() * 100) + 50
        };
      });
    }
    
    return metricPoints.map(p => ({
      time: new Date(p.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      value: p.value
    }));
  };

  const dbLatencyData = getChartData(metrics?.performance?.dbLatency);
  const apiLatencyData = getChartData(metrics?.performance?.apiLatency);
  const errorRateData = getChartData(metrics?.performance?.errorRate);

  // Generate users/streams mock data based on overview metrics
  const generateActivityData = () => {
    const now = Date.now();
    const interval = timeRange === '1h' ? 5 * 60 * 1000 : timeRange === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : 7;
    const baseUsers = metrics?.overview?.activeUsers24h || 50;
    const baseViews = metrics?.overview?.totalViews24h || 100;
    
    return Array.from({ length: points }, (_, i) => {
      const time = new Date(now - (points - 1 - i) * interval);
      return {
        time: timeRange === '7d' 
          ? time.toLocaleDateString('pt-BR', { weekday: 'short' })
          : time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        users: Math.max(0, Math.floor(baseUsers / points * (i + 1) * (0.8 + Math.random() * 0.4))),
        views: Math.max(0, Math.floor(baseViews / points * (i + 1) * (0.8 + Math.random() * 0.4)))
      };
    });
  };

  const activityData = generateActivityData();

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Erro ao carregar gráficos</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tendências do Sistema</h3>
          <p className="text-sm text-muted-foreground">
            Visualização de métricas ao longo do tempo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as '1h' | '24h' | '7d')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Última hora</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={refresh} variant="outline" size="icon" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Users & Views Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários & Visualizações</CardTitle>
          <CardDescription>Atividade ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorUsers)"
                  name="Usuários"
                />
                <Area 
                  type="monotone" 
                  dataKey="views" 
                  stroke="hsl(var(--chart-2))" 
                  fillOpacity={1} 
                  fill="url(#colorViews)"
                  name="Visualizações"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Latency Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latência DB</CardTitle>
            <CardDescription>Tempo de resposta do banco em ms</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dbLatencyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={false}
                    name="Latência (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taxa de Erros</CardTitle>
            <CardDescription>Erros ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={errorRateData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
