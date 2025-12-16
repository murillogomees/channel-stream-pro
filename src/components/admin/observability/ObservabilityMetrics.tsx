/**
 * ObservabilityMetrics - Real-time metrics dashboard
 */

import { useObservability } from "@/hooks/useObservability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Users, Play, Activity, Wifi, Tv, Heart } from "lucide-react";

export default function ObservabilityMetrics() {
  const { metrics, isLoading, error, refresh } = useObservability({
    autoRefresh: true,
    refreshInterval: 30000,
    timeRange: '24h'
  });

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Erro ao carregar métricas</CardTitle>
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
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Métricas em Tempo Real</h3>
          <p className="text-sm text-muted-foreground">
            Atualizado automaticamente a cada 30 segundos
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Main metrics grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Users */}
        <MetricCard
          title="Usuários Ativos"
          value={metrics?.overview?.activeUsers24h}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
          description="Últimas 24h"
        />

        {/* Total Channels */}
        <MetricCard
          title="Total Canais"
          value={metrics?.overview?.totalChannels}
          icon={<Tv className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
          description="Cadastrados"
        />

        {/* Healthy Channels */}
        <MetricCard
          title="Canais Saudáveis"
          value={metrics?.overview?.healthyChannels}
          icon={<Heart className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
          description="Online"
          badge={metrics?.overview?.totalChannels && metrics.overview.healthyChannels < metrics.overview.totalChannels * 0.8 ? "Atenção" : undefined}
          badgeVariant="destructive"
        />

        {/* Total Views */}
        <MetricCard
          title="Visualizações"
          value={metrics?.overview?.totalViews24h}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
          description="Últimas 24h"
          formatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
        />
      </div>

      {/* Streaming metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance de Streaming</CardTitle>
          <CardDescription>Métricas de streaming e failover</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Latência Média</p>
                <p className="text-2xl font-bold">
                  {metrics?.streaming?.avgLatency?.toFixed(0) || '0'}ms
                </p>
                <Badge variant={metrics?.streaming?.avgLatency && metrics.streaming.avgLatency < 500 ? "default" : "destructive"}>
                  {metrics?.streaming?.avgLatency && metrics.streaming.avgLatency < 500 ? "Bom" : "Lento"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Failovers</p>
                <p className="text-2xl font-bold">
                  {metrics?.streaming?.failovers || 0}
                </p>
                <Badge variant={metrics?.streaming?.failovers && metrics.streaming.failovers < 10 ? "default" : "destructive"}>
                  {metrics?.streaming?.failovers && metrics.streaming.failovers < 10 ? "Normal" : "Alto"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Buffer Events (avg)</p>
                <p className="text-2xl font-bold">
                  {metrics?.overview?.avgBufferEvents?.toFixed(1) || '0'}
                </p>
                <Badge variant={metrics?.overview?.avgBufferEvents && metrics.overview.avgBufferEvents < 2 ? "default" : "destructive"}>
                  {metrics?.overview?.avgBufferEvents && metrics.overview.avgBufferEvents < 2 ? "Bom" : "Atenção"}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Origin Health */}
      {metrics?.streaming?.originHealth && Object.keys(metrics.streaming.originHealth).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saúde das Origins</CardTitle>
            <CardDescription>Score de saúde por origin server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3">
              {Object.entries(metrics.streaming.originHealth).map(([origin, score]) => (
                <div key={origin} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-sm font-medium">{origin}</span>
                  <Badge variant={score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive"}>
                    {score}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  description?: string;
  suffix?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  formatter?: (value: number) => string;
}

function MetricCard({ 
  title, 
  value, 
  icon, 
  loading, 
  description, 
  suffix, 
  badge, 
  badgeVariant = "secondary",
  formatter 
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatter ? formatter(value || 0) : value || 0}
              {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
            </span>
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
