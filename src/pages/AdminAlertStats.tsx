import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AlertCircle, TrendingUp, Clock, CheckCircle2, AlertTriangle, Activity, Trophy, Users } from "lucide-react";
import { getSecurityAlertStatsService, type AlertPerformanceStats, type AdminPerformanceStats } from "@/services/securityAlertStatsService";
import { getAdminBadgeService } from "@/services/adminBadgeService";
import { AdminBadges } from "@/components/admin/AdminBadges";
import { AdminComparison } from "@/components/admin/AdminComparison";
import type { AdminAchievements } from "@/types/badge";

export default function AdminAlertStats() {
  const [period, setPeriod] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [performanceStats, setPerformanceStats] = useState<AlertPerformanceStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminPerformanceStats[]>([]);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const [adminAchievements, setAdminAchievements] = useState<Map<string, AdminAchievements>>(new Map());
  const [selectedAdminsForComparison, setSelectedAdminsForComparison] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    const service = getSecurityAlertStatsService();
    const badgeService = getAdminBadgeService();

    const [performance, admins, metrics] = await Promise.all([
      service.getAlertPerformanceStats(period),
      service.getAdminPerformanceStats(period),
      service.getAlertMetricsByPeriod(Math.min(period, 30))
    ]);

    setPerformanceStats(performance);
    setAdminStats(admins);
    setMetricsData(metrics);

    // Calcular achievements para cada admin
    const achievementsMap = new Map<string, AdminAchievements>();
    admins.forEach((admin, index) => {
      const achievements = badgeService.generateAchievements(admin, index + 1);
      achievementsMap.set(admin.admin_id, achievements);
    });
    setAdminAchievements(achievementsMap);

    setLoading(false);
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    if (minutes < 60) return `${Math.round(minutes)}min`;
    return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}min`;
  };

  const toggleAdminComparison = (adminId: string) => {
    setSelectedAdminsForComparison(prev => {
      const newSet = new Set(prev);
      if (newSet.has(adminId)) {
        newSet.delete(adminId);
      } else {
        if (newSet.size < 3) {
          newSet.add(adminId);
        }
      }
      return newSet;
    });
  };

  const getComparisonData = () => {
    return adminStats
      .filter(admin => selectedAdminsForComparison.has(admin.admin_id))
      .map(admin => ({
        stats: admin,
        achievements: adminAchievements.get(admin.admin_id)!
      }))
      .filter(item => item.achievements);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Estatísticas de Alertas</h1>
          <p className="text-muted-foreground">Performance e métricas dos alertas de segurança</p>
        </div>
        <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceStats?.total_alerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {performanceStats?.confirmed_alerts || 0} confirmados ({performanceStats?.confirmation_rate || 0}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Leitura</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(performanceStats?.avg_read_time_minutes || null)}
            </div>
            <p className="text-xs text-muted-foreground">
              Desde envio até leitura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Confirmação</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(performanceStats?.avg_confirmation_time_minutes || null)}
            </div>
            <p className="text-xs text-muted-foreground">
              Desde envio até confirmação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Escalonamento</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceStats?.escalation_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {performanceStats?.total_escalations || 0} alertas escalonados
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="admins">Performance por Admin</TabsTrigger>
          <TabsTrigger value="comparison">
            <Users className="h-4 w-4 mr-2" />
            Comparação
          </TabsTrigger>
          <TabsTrigger value="gamification">
            <Trophy className="h-4 w-4 mr-2" />
            Gamificação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Alertas</CardTitle>
              <CardDescription>Distribuição diária de alertas nos últimos {Math.min(period, 30)} dias</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Total" />
                  <Line type="monotone" dataKey="confirmed" stroke="hsl(var(--success))" name="Confirmados" />
                  <Line type="monotone" dataKey="escalated" stroke="hsl(var(--destructive))" name="Escalonados" />
                  <Line type="monotone" dataKey="with_action" stroke="hsl(var(--accent))" name="Com Ação" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparativo de Métricas</CardTitle>
              <CardDescription>Comparação de confirmação vs escalonamento</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="confirmed" fill="hsl(var(--success))" name="Confirmados" />
                  <Bar dataKey="escalated" fill="hsl(var(--destructive))" name="Escalonados" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Performance</CardTitle>
              <CardDescription>Desempenho individual de cada administrador. Selecione até 3 admins para comparar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedAdminsForComparison.size === adminStats.length && adminStats.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAdminsForComparison(new Set(adminStats.slice(0, 3).map(a => a.admin_id)));
                          } else {
                            setSelectedAdminsForComparison(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Badges & Conquistas</TableHead>
                    <TableHead className="text-right">Total Alertas</TableHead>
                    <TableHead className="text-right">Taxa Confirmação</TableHead>
                    <TableHead className="text-right">Tempo Resposta</TableHead>
                    <TableHead className="text-right">Ações Tomadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminStats.map((admin, index) => {
                    const achievements = adminAchievements.get(admin.admin_id);
                    const isSelected = selectedAdminsForComparison.has(admin.admin_id);
                    const canSelect = selectedAdminsForComparison.size < 3 || isSelected;
                    
                    return (
                      <TableRow key={admin.admin_id} className={isSelected ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            disabled={!canSelect}
                            onCheckedChange={() => toggleAdminComparison(admin.admin_id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Badge variant={index === 0 ? "default" : "outline"}>
                            #{index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{admin.admin_name}</div>
                            <div className="text-sm text-muted-foreground">{admin.admin_phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {achievements && <AdminBadges achievements={achievements} compact />}
                        </TableCell>
                        <TableCell className="text-right">{admin.total_alerts}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={admin.confirmation_rate >= 80 ? "default" : "secondary"}>
                            {admin.confirmation_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTime(admin.avg_response_time_minutes)}
                        </TableCell>
                        <TableCell className="text-right">{admin.alerts_with_action}</TableCell>
                      </TableRow>
                    );
                  })}
                  {adminStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nenhum dado disponível para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Comparação */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comparação entre Administradores</CardTitle>
              <CardDescription>
                {selectedAdminsForComparison.size === 0 
                  ? 'Selecione até 3 admins na aba "Performance por Admin" para comparar' 
                  : `Comparando ${selectedAdminsForComparison.size} administrador(es)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminComparison admins={getComparisonData()} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Gamificação */}
        <TabsContent value="gamification" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {adminStats.map((admin, index) => {
              const achievements = adminAchievements.get(admin.admin_id);
              if (!achievements) return null;

              return (
                <div key={admin.admin_id} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{admin.admin_name}</span>
                        <Badge variant={index === 0 ? "default" : "outline"}>
                          #{index + 1}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{admin.admin_phone}</CardDescription>
                    </CardHeader>
                  </Card>
                  <AdminBadges achievements={achievements} />
                </div>
              );
            })}
          </div>

          {adminStats.length === 0 && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">
                  Nenhum dado disponível para o período selecionado
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
