import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  Zap, 
  AlertTriangle, 
  Wifi, 
  Monitor, 
  Clock, 
  TrendingUp, 
  Server,
  RefreshCw,
  PlayCircle
} from "lucide-react";
import { useStreamingMetrics } from "./useStreamingMetrics";
import { StreamingMetricsCard } from "./StreamingMetricsCard";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function StreamingDashboard() {
  const [days, setDays] = useState(7);
  const { data: metrics, isLoading, refetch, isRefetching } = useStreamingMetrics(days);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["streaming-metrics"] });
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum dado de streaming disponível</p>
          <p className="text-sm text-muted-foreground mt-2">
            Os dados aparecerão quando usuários começarem a assistir conteúdo
          </p>
        </CardContent>
      </Card>
    );
  }

  const getQualityLabel = (bitrate: number) => {
    if (bitrate >= 8000) return { label: "4K", color: "text-purple-500" };
    if (bitrate >= 4000) return { label: "1080p", color: "text-green-500" };
    if (bitrate >= 1500) return { label: "720p", color: "text-blue-500" };
    if (bitrate >= 500) return { label: "480p", color: "text-yellow-500" };
    return { label: "SD", color: "text-orange-500" };
  };

  const qualityInfo = getQualityLabel(metrics.avgBitrate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">Performance de Streaming</h2>
          <p className="text-sm text-muted-foreground">
            Métricas em tempo real de reprodução de conteúdo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StreamingMetricsCard
          title="Sessões Totais"
          value={metrics.totalSessions.toLocaleString()}
          subtitle={`nos últimos ${days} dias`}
          icon={PlayCircle}
        />
        <StreamingMetricsCard
          title="Tempo de Início"
          value={`${metrics.avgStartupTime}ms`}
          subtitle={metrics.avgStartupTime < 2000 ? "Excelente" : metrics.avgStartupTime < 4000 ? "Bom" : "Precisa melhorar"}
          icon={Zap}
        />
        <StreamingMetricsCard
          title="Eventos de Buffer"
          value={metrics.avgBufferEvents}
          subtitle={`média por sessão`}
          icon={Clock}
        />
        <StreamingMetricsCard
          title="Taxa de Cache"
          value={`${metrics.cacheHitRate}%`}
          subtitle="hit rate no CDN"
          icon={Server}
        />
        <StreamingMetricsCard
          title="Qualidade Média"
          value={qualityInfo.label}
          subtitle={`${metrics.avgBitrate} kbps`}
          icon={TrendingUp}
          className={qualityInfo.color}
        />
        <StreamingMetricsCard
          title="Rebuffer Médio"
          value={`${(metrics.avgRebufferDuration / 1000).toFixed(1)}s`}
          subtitle="tempo de rebuffer"
          icon={RefreshCw}
        />
        <StreamingMetricsCard
          title="Erros"
          value={metrics.totalErrors}
          subtitle="falhas de reprodução"
          icon={AlertTriangle}
          className={metrics.totalErrors > 10 ? "border-red-500/50" : ""}
        />
        <StreamingMetricsCard
          title="Conexões"
          value={metrics.routeTypeBreakdown.length > 0 ? metrics.routeTypeBreakdown[0].route : "N/A"}
          subtitle="rota mais usada"
          icon={Wifi}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessões por Hora (24h)</CardTitle>
            <CardDescription>Volume de reproduções ao longo do dia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sessions" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                    name="Sessões"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={false}
                    name="Erros"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Startup Time by Hour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tempo de Início (24h)</CardTitle>
            <CardDescription>Média de startup time em ms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value) => [`${value}ms`, "Startup"]}
                  />
                  <Bar 
                    dataKey="avgStartup" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Startup Time"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Dispositivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.deviceBreakdown.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.deviceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="device"
                    >
                      {metrics.deviceBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend 
                      formatter={(value) => <span className="text-xs capitalize">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem dados de dispositivos
              </p>
            )}
          </CardContent>
        </Card>

        {/* Route Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Rotas de CDN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.routeTypeBreakdown.length > 0 ? (
                metrics.routeTypeBreakdown.map((route, i) => {
                  const total = metrics.routeTypeBreakdown.reduce((a, b) => a + b.count, 0);
                  const percentage = ((route.count / total) * 100).toFixed(1);
                  return (
                    <div key={route.route} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm capitalize">{route.route}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{route.count}</span>
                        <Badge variant="outline" className="text-xs">
                          {percentage}%
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de rotas
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Top Canais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {metrics.topChannels.length > 0 ? (
                metrics.topChannels.slice(0, 5).map((channel, i) => (
                  <div 
                    key={channel.channelId} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">
                        {i + 1}
                      </span>
                      <span className="text-sm truncate max-w-[100px]">
                        {channel.channelId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{channel.sessions}</Badge>
                      <span className="text-muted-foreground">
                        {channel.avgStartup}ms
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de canais
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dicas de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metrics.avgStartupTime > 3000 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  ⚡ Startup lento
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Considere ativar Argo Smart Routing no Cloudflare para reduzir latência
                </p>
              </div>
            )}
            {metrics.cacheHitRate < 70 && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  📦 Cache baixo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Aumente o TTL de cache para segmentos HLS para melhorar hit rate
                </p>
              </div>
            )}
            {metrics.avgBufferEvents > 2 && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  🔄 Muito buffering
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Considere implementar ABR (Adaptive Bitrate) para ajustar qualidade
                </p>
              </div>
            )}
            {metrics.avgStartupTime <= 2000 && metrics.cacheHitRate >= 80 && metrics.avgBufferEvents <= 1 && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 md:col-span-3">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✅ Performance excelente!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Seu streaming está otimizado. Continue monitorando para manter a qualidade.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
