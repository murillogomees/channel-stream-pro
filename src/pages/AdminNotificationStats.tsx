import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Activity, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNotificationLogs } from "@/hooks/useNotificationLogs";
import { NotificationStatsService } from "@/services/notificationStatsService";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = {
  success: 'hsl(var(--chart-1))',
  error: 'hsl(var(--chart-5))',
  total: 'hsl(var(--chart-3))',
};

const AdminNotificationStats = () => {
  const navigate = useNavigate();
  const { logs } = useNotificationLogs();
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  
  const statsService = useMemo(() => new NotificationStatsService(logs), [logs]);
  
  const overallStats = useMemo(() => statsService.getOverallStats(), [statsService]);
  const dailyStats = useMemo(() => statsService.getDailyStats(parseInt(timeRange)), [statsService, timeRange]);
  const typeStats = useMemo(() => statsService.getTypeStats(), [statsService]);
  const recentActivity = useMemo(() => statsService.getRecentActivity(10), [statsService]);
  const errorAnalysis = useMemo(() => statsService.getErrorAnalysis(), [statsService]);
  const hourlyDistribution = useMemo(() => statsService.getHourlyDistribution(), [statsService]);

  const pieData = [
    { name: 'Sucesso', value: overallStats.totalSuccess, color: COLORS.success },
    { name: 'Erro', value: overallStats.totalErrors, color: COLORS.error },
  ];

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM', { locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Estatísticas de Notificações</h1>
            <p className="text-muted-foreground">
              Análise detalhada do desempenho de envio de mensagens
            </p>
          </div>
        </div>

        {/* Cards de Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Enviado</p>
                  <p className="text-2xl font-bold">{overallStats.totalSent}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold">{overallStats.overallSuccessRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Últimas 24h</p>
                  <p className="text-2xl font-bold text-green-600">{overallStats.last24hSuccess}</p>
                  <p className="text-sm text-red-600">{overallStats.last24hErrors} erros</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
                  <p className="text-2xl font-bold text-green-600">{overallStats.last7DaysSuccess}</p>
                  <p className="text-sm text-red-600">{overallStats.last7DaysErrors} erros</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs com diferentes visualizações */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="types">Por Tipo</TabsTrigger>
            <TabsTrigger value="errors">Análise de Erros</TabsTrigger>
            <TabsTrigger value="hourly">Distribuição Horária</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Gráfico de Linha - Taxa ao longo do tempo */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Taxa de Sucesso/Falha</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={timeRange === '7' ? 'default' : 'outline'}
                        onClick={() => setTimeRange('7')}
                      >
                        7d
                      </Button>
                      <Button
                        size="sm"
                        variant={timeRange === '30' ? 'default' : 'outline'}
                        onClick={() => setTimeRange('30')}
                      >
                        30d
                      </Button>
                      <Button
                        size="sm"
                        variant={timeRange === '90' ? 'default' : 'outline'}
                        onClick={() => setTimeRange('90')}
                      >
                        90d
                      </Button>
                    </div>
                  </div>
                  <CardDescription>Evolução diária das notificações</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={formatDate}
                        fontSize={12}
                      />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="success" 
                        stroke={COLORS.success} 
                        name="Sucesso"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="error" 
                        stroke={COLORS.error} 
                        name="Erro"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Pizza - Proporção */}
              <Card>
                <CardHeader>
                  <CardTitle>Proporção Geral</CardTitle>
                  <CardDescription>Sucesso vs Falha</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Atividade Recente */}
            <Card>
              <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>Últimas 10 notificações enviadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{log.clienteNome}</p>
                          <p className="text-sm text-muted-foreground">{log.template}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                          {log.status === 'success' ? 'Sucesso' : 'Erro'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.dataEnvio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Types Tab */}
          <TabsContent value="types">
            <Card>
              <CardHeader>
                <CardTitle>Notificações por Tipo</CardTitle>
                <CardDescription>Distribuição e taxa de sucesso por tipo de notificação</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={typeStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successCount" fill={COLORS.success} name="Sucesso" />
                    <Bar dataKey="errorCount" fill={COLORS.error} name="Erro" />
                  </BarChart>
                </ResponsiveContainer>
                
                <div className="mt-6 space-y-3">
                  {typeStats.map((stat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{stat.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {stat.count} envios totais
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{stat.successRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.successCount} sucesso / {stat.errorCount} erro
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Erros</CardTitle>
                <CardDescription>Erros mais comuns no envio de notificações</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorAnalysis.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                      <p className="text-lg font-medium">Nenhum erro registrado</p>
                      <p className="text-sm text-muted-foreground">
                        Todas as notificações foram enviadas com sucesso!
                      </p>
                    </div>
                  ) : (
                    errorAnalysis.map((error, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <div className="flex-1">
                            <p className="font-medium">{error.error}</p>
                            <p className="text-sm text-muted-foreground">
                              Ocorreu {error.count} {error.count === 1 ? 'vez' : 'vezes'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="destructive">{error.count}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hourly Tab */}
          <TabsContent value="hourly">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição Horária</CardTitle>
                <CardDescription>Volume de notificações por hora do dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={hourlyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success" fill={COLORS.success} name="Sucesso" stackId="a" />
                    <Bar dataKey="error" fill={COLORS.error} name="Erro" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminNotificationStats;
