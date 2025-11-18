import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Server, Zap, Download, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSystemHealthService, SystemHealthStatus } from '@/services/systemHealthService';
import { getWebSocketMetricsService, WebSocketMetrics, MetricsSnapshot } from '@/services/websocketMetricsService';
import { getAdminAlertService, AdminAlert } from '@/services/adminAlertService';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminSystemHealth = () => {
  const navigate = useNavigate();
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [metrics, setMetrics] = useState<WebSocketMetrics | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [snapshots, setSnapshots] = useState<MetricsSnapshot[]>([]);

  useEffect(() => {
    const healthService = getSystemHealthService();
    const metricsService = getWebSocketMetricsService();
    const alertService = getAdminAlertService();

    // Start monitoring
    healthService.startMonitoring(30000);
    
    const updateData = () => {
      setHealth(healthService.getStatus());
      setMetrics(metricsService.getMetrics());
      setAlerts(alertService.getUnacknowledgedAlerts());
      setSnapshots(metricsService.getSnapshotHistory());
    };

    updateData();
    const interval = setInterval(updateData, 5000);

    return () => {
      clearInterval(interval);
      healthService.stopMonitoring();
    };
  }, []);

  const exportMetrics = () => {
    const metricsService = getWebSocketMetricsService();
    const data = metricsService.exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${Date.now()}.json`;
    a.click();
  };


  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Prepare chart data
  const latencyChartData = snapshots.map(snapshot => ({
    time: format(new Date(snapshot.timestamp), 'HH:mm:ss', { locale: ptBR }),
    timestamp: snapshot.timestamp,
    latencia: Math.round(snapshot.metrics.averageLatency),
    minima: Math.round(snapshot.metrics.minLatency),
    maxima: Math.round(snapshot.metrics.maxLatency),
  })).slice(-30); // Last 30 snapshots

  const uptimeChartData = snapshots.map(snapshot => ({
    time: format(new Date(snapshot.timestamp), 'HH:mm:ss', { locale: ptBR }),
    timestamp: snapshot.timestamp,
    uptime: Math.round(snapshot.metrics.totalUptime / 1000 / 60), // Convert to minutes
    downtime: Math.round(snapshot.metrics.totalDowntime / 1000 / 60),
  })).slice(-30);

  const connectionChartData = snapshots.map(snapshot => ({
    time: format(new Date(snapshot.timestamp), 'HH:mm:ss', { locale: ptBR }),
    timestamp: snapshot.timestamp,
    sucesso: snapshot.metrics.successfulConnections,
    falhas: snapshot.metrics.failedConnections,
    taxa: snapshot.metrics.totalConnections > 0 
      ? Math.round((snapshot.metrics.successfulConnections / snapshot.metrics.totalConnections) * 100)
      : 0,
  })).slice(-30);

  const eventsChartData = snapshots.map(snapshot => ({
    time: format(new Date(snapshot.timestamp), 'HH:mm:ss', { locale: ptBR }),
    timestamp: snapshot.timestamp,
    enviados: snapshot.metrics.totalEventsSent,
    recebidos: snapshot.metrics.totalEventsReceived,
    falhas: snapshot.metrics.failedEvents,
  })).slice(-30);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Saúde do Sistema</h1>
            <p className="text-muted-foreground">Monitoramento de todos os serviços</p>
          </div>
          <Button onClick={exportMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Métricas
          </Button>
        </div>

        {/* Overall Status */}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle>Status Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBadge status={health.overall} />
            </CardContent>
          </Card>
        )}

        {/* Services */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(health.services).map(([key, service]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{service.name}</span>
                    <StatusBadge status={service.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {service.latency !== null && (
                    <div>Latência: {service.latency}ms</div>
                  )}
                  {service.error && (
                    <div className="text-sm text-red-500">{service.error}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* WebSocket Metrics */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Métricas WebSocket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                  <div className="text-2xl font-bold">{formatUptime(metrics.totalUptime)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Conexões</div>
                  <div className="text-2xl font-bold">{metrics.successfulConnections}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Latência Média</div>
                  <div className="text-2xl font-bold">{metrics.averageLatency.toFixed(0)}ms</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Taxa Sucesso</div>
                  <div className="text-2xl font-bold">
                    {((metrics.successfulConnections / Math.max(metrics.totalConnections, 1)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              
              {metrics.totalConnections > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Taxa de Sucesso</div>
                  <Progress value={(metrics.successfulConnections / metrics.totalConnections) * 100} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trend Charts */}
        {snapshots.length > 5 && (
          <Tabs defaultValue="latency" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="latency">
                <TrendingUp className="h-4 w-4 mr-2" />
                Latência
              </TabsTrigger>
              <TabsTrigger value="uptime">
                <Clock className="h-4 w-4 mr-2" />
                Uptime
              </TabsTrigger>
              <TabsTrigger value="connections">
                <Activity className="h-4 w-4 mr-2" />
                Conexões
              </TabsTrigger>
              <TabsTrigger value="events">
                <Zap className="h-4 w-4 mr-2" />
                Eventos
              </TabsTrigger>
            </TabsList>

            {/* Latency Chart */}
            <TabsContent value="latency">
              <Card>
                <CardHeader>
                  <CardTitle>Latência ao Longo do Tempo</CardTitle>
                  <CardDescription>
                    Evolução da latência de conexão WebSocket (últimos {latencyChartData.length} snapshots)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={latencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        label={{ value: 'Latência (ms)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="latencia" 
                        stroke="hsl(var(--primary))" 
                        name="Média"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="minima" 
                        stroke="hsl(142 76% 36%)" 
                        name="Mínima"
                        strokeDasharray="5 5"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="maxima" 
                        stroke="hsl(0 72% 51%)" 
                        name="Máxima"
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Uptime/Downtime Chart */}
            <TabsContent value="uptime">
              <Card>
                <CardHeader>
                  <CardTitle>Uptime vs Downtime</CardTitle>
                  <CardDescription>
                    Tempo de atividade vs inatividade em minutos (últimos {uptimeChartData.length} snapshots)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={uptimeChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        label={{ value: 'Tempo (minutos)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="uptime" 
                        stackId="1"
                        stroke="hsl(142 76% 36%)" 
                        fill="hsl(142 76% 36% / 0.3)" 
                        name="Uptime"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="downtime" 
                        stackId="1"
                        stroke="hsl(0 72% 51%)" 
                        fill="hsl(0 72% 51% / 0.3)" 
                        name="Downtime"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Connections Chart */}
            <TabsContent value="connections">
              <Card>
                <CardHeader>
                  <CardTitle>Conexões Bem-Sucedidas vs Falhas</CardTitle>
                  <CardDescription>
                    Evolução das tentativas de conexão (últimos {connectionChartData.length} snapshots)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={connectionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        label={{ value: 'Conexões', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="sucesso" 
                        fill="hsl(142 76% 36%)" 
                        name="Sucesso"
                      />
                      <Bar 
                        dataKey="falhas" 
                        fill="hsl(0 72% 51%)" 
                        name="Falhas"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  {/* Success Rate Line */}
                  <div className="mt-6">
                    <div className="text-sm text-muted-foreground mb-2">Taxa de Sucesso ao Longo do Tempo</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={connectionChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="time" 
                          tick={{ fontSize: 12 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          domain={[0, 100]}
                          label={{ value: 'Taxa (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                          formatter={(value) => `${value}%`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="taxa" 
                          stroke="hsl(var(--primary))" 
                          name="Taxa de Sucesso"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Events Chart */}
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Eventos WebSocket</CardTitle>
                  <CardDescription>
                    Eventos enviados, recebidos e falhados (últimos {eventsChartData.length} snapshots)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={eventsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        label={{ value: 'Eventos', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="enviados" 
                        stroke="hsl(var(--primary))" 
                        name="Enviados"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="recebidos" 
                        stroke="hsl(142 76% 36%)" 
                        name="Recebidos"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="falhas" 
                        stroke="hsl(0 72% 51%)" 
                        name="Falhas"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas Não Reconhecidos ({alerts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{alert.title}</div>
                      <div className="text-sm text-muted-foreground">{alert.message}</div>
                    </div>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminSystemHealth;
