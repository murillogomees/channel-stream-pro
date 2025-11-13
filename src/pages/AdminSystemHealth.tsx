import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Server, Zap, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getSystemHealthService, SystemHealthStatus } from '@/services/systemHealthService';
import { getWebSocketMetricsService, WebSocketMetrics } from '@/services/websocketMetricsService';
import { getAdminAlertService, AdminAlert } from '@/services/adminAlertService';

const AdminSystemHealth = () => {
  const navigate = useNavigate();
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [metrics, setMetrics] = useState<WebSocketMetrics | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'down': case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

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
              <Badge className={getStatusColor(health.overall)}>
                {health.overall.toUpperCase()}
              </Badge>
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
                    <Badge className={getStatusColor(service.status)}>
                      {service.status}
                    </Badge>
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
