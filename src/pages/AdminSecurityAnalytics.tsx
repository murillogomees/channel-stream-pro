import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, PieChart, TrendingUp, Clock, Shield, AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { securityAnalyticsService } from "@/services/securityAnalyticsService";
import { ipBlockingService } from "@/services/ipBlockingService";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AdminSecurityAnalytics() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('7');
  const [loading, setLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<any[]>([]);
  const [eventDistribution, setEventDistribution] = useState<any[]>([]);
  const [severityDistribution, setSeverityDistribution] = useState<any[]>([]);
  const [hourlyPattern, setHourlyPattern] = useState<any[]>([]);
  const [resolutionRate, setResolutionRate] = useState({ resolved: 0, unresolved: 0 });
  const [topThreats, setTopThreats] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    const days = parseInt(timeRange);
    
    const [daily, events, severity, hourly, resolution, threats] = await Promise.all([
      securityAnalyticsService.getDailyMetrics(days),
      securityAnalyticsService.getEventTypeDistribution(days),
      securityAnalyticsService.getSeverityDistribution(days),
      securityAnalyticsService.getHourlyPattern(days),
      securityAnalyticsService.getResolutionRate(days),
      ipBlockingService.getTopThreatIPs(10)
    ]);

    setDailyMetrics(daily.reverse()); // Reverse to show oldest first
    setEventDistribution(events);
    setSeverityDistribution(severity);
    setHourlyPattern(hourly);
    setResolutionRate(resolution);
    setTopThreats(threats);
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Analytics de Segurança
          </h1>
          <p className="text-muted-foreground">
            Análise de tendências e padrões de segurança
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadAnalytics}>
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8">Carregando analytics...</p>
      ) : (
        <>
          {/* Daily Events Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tendência de Eventos
              </CardTitle>
              <CardDescription>Evolução diária dos eventos de segurança</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="total_events" stackId="1" stroke="#8884d8" fill="#8884d8" name="Total" />
                  <Area type="monotone" dataKey="failed_logins" stackId="1" stroke="#ff4444" fill="#ff4444" name="Login Falhou" />
                  <Area type="monotone" dataKey="suspicious_activities" stackId="1" stroke="#ffaa00" fill="#ffaa00" name="Suspeitas" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Event Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Distribuição por Tipo
                </CardTitle>
                <CardDescription>Proporção de cada tipo de evento</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={eventDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {eventDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Distribuição por Severidade
                </CardTitle>
                <CardDescription>Proporção de eventos críticos, avisos e informações</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={severityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Pattern */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Padrão de Atividade por Hora
              </CardTitle>
              <CardDescription>Distribuição de eventos ao longo do dia</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyPattern}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" label={{ value: 'Hora do Dia', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Eventos', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" name="Eventos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Resolution Rate */}
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Resolução</CardTitle>
                <CardDescription>Eventos resolvidos vs não resolvidos</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: 'Resolvidos', value: resolutionRate.resolved },
                        { name: 'Não Resolvidos', value: resolutionRate.unresolved }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#00C49F" />
                      <Cell fill="#FF8042" />
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Taxa: {resolutionRate.resolved + resolutionRate.unresolved > 0 
                      ? Math.round((resolutionRate.resolved / (resolutionRate.resolved + resolutionRate.unresolved)) * 100)
                      : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Top Threat IPs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Top IPs Ameaçadores
                </CardTitle>
                <CardDescription>IPs com mais atividades suspeitas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topThreats.slice(0, 5).map((threat, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{threat.ip_address}</span>
                        {threat.is_blocked && (
                          <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded">
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{threat.event_count} eventos</p>
                        <p className="text-xs text-muted-foreground">
                          {threat.failed_logins} logins falhos
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
