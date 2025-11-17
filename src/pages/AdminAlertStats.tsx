import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Activity, TrendingUp, Clock, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  getSecurityAlertStatsService, 
  AlertPerformanceStats, 
  AdminPerformanceStats 
} from '@/services/securityAlertStatsService';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function AdminAlertStats() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const statsService = getSecurityAlertStatsService();
  
  const [alertStats, setAlertStats] = useState<AlertPerformanceStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminPerformanceStats[]>([]);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
      return;
    }

    loadStats();
  }, [authLoading, isAdmin, navigate, selectedPeriod]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [alertData, adminData, metricsData] = await Promise.all([
        statsService.getAlertPerformanceStats(selectedPeriod),
        statsService.getAdminPerformanceStats(selectedPeriod),
        statsService.getAlertMetricsByPeriod(selectedPeriod),
      ]);
      
      setAlertStats(alertData);
      setAdminStats(adminData);
      setMetricsData(metricsData);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as estatísticas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Estatísticas de Alertas</h1>
              <p className="text-muted-foreground">
                Desempenho e métricas do sistema de alertas
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant={selectedPeriod === days ? 'default' : 'outline'}
                onClick={() => setSelectedPeriod(days)}
              >
                {days} dias
              </Button>
            ))}
          </div>
        </div>

        {/* Cards de Resumo */}
        {alertStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total de Alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alertStats.total_alerts}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {alertStats.confirmed_alerts} confirmados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Taxa de Confirmação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alertStats.confirmation_rate}%</div>
                <Progress value={alertStats.confirmation_rate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tempo Médio de Resposta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {alertStats.avg_confirmation_time_minutes?.toFixed(1) || 0} min
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leitura: {alertStats.avg_read_time_minutes?.toFixed(1) || 0} min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Taxa de Escalonamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alertStats.escalation_rate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {alertStats.total_escalations} escalados
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Gráfico de Tendências */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendência de Alertas
            </CardTitle>
            <CardDescription>
              Distribuição de alertas ao longo do período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Total"
                />
                <Line 
                  type="monotone" 
                  dataKey="confirmed" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Confirmados"
                />
                <Line 
                  type="monotone" 
                  dataKey="escalated" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  name="Escalados"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance dos Administradores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Performance dos Administradores
            </CardTitle>
            <CardDescription>
              Desempenho individual de cada administrador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adminStats.map((admin, index) => (
                <div key={admin.admin_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{admin.admin_name}</h3>
                      <p className="text-sm text-muted-foreground">{admin.admin_phone}</p>
                    </div>
                    {index < 3 && (
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        Top {index + 1}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Alertas</p>
                      <p className="font-semibold">{admin.total_alerts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa Confirmação</p>
                      <p className="font-semibold">{admin.confirmation_rate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tempo Resposta</p>
                      <p className="font-semibold">
                        {admin.avg_response_time_minutes?.toFixed(1) || 0} min
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Com Ação</p>
                      <p className="font-semibold">{admin.alerts_with_action}</p>
                    </div>
                  </div>
                  
                  <Progress 
                    value={admin.confirmation_rate} 
                    className="mt-3"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
