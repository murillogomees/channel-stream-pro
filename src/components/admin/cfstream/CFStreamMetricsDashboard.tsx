/**
 * CFStreamMetricsDashboard - Dashboard de métricas de playback
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  Percent,
  BarChart3,
  Video,
  HardDrive,
  Zap
} from "lucide-react";
import { useCFStreamAnalytics, TIME_RANGES, ChannelMetrics } from "@/hooks/useCFStreamAnalytics";
import { cn } from "@/lib/utils";

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = "default"
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "error";
}) {
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-500",
    warning: "bg-yellow-500/10 text-yellow-500",
    error: "bg-red-500/10 text-red-500",
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                trend.isPositive ? "text-green-500" : "text-red-500"
              )}>
                {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", variantStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelMetricsTable({ 
  metrics, 
  isLoading 
}: { 
  metrics: ChannelMetrics[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum canal com métricas disponíveis
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      ready: { label: "Pronto", variant: "default" },
      processing: { label: "Processando", variant: "secondary" },
      uploading: { label: "Enviando", variant: "secondary" },
      queued: { label: "Na Fila", variant: "outline" },
      error: { label: "Erro", variant: "destructive" },
      retry_scheduled: { label: "Retry", variant: "secondary" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {metrics.map((channel) => (
          <Card key={channel.channel_id} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{channel.channel_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    UID: {channel.cf_stream_uid || "N/A"}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(channel.duration_seconds)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>{channel.bandwidth_gb.toFixed(2)} GB</span>
                  </div>
                  
                  {channel.errors > 0 && (
                    <div className="flex items-center gap-1.5 text-red-500">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{channel.errors}</span>
                    </div>
                  )}
                  
                  {getStatusBadge(channel.status)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function ProcessingStats({ 
  aggregated, 
  isLoading 
}: { 
  aggregated: ReturnType<typeof useCFStreamAnalytics>["aggregated"];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const total = aggregated.total_vods_ready + aggregated.total_vods_processing + aggregated.total_vods_failed;
  const successPercent = total > 0 ? (aggregated.total_vods_ready / total) * 100 : 0;
  const processingPercent = total > 0 ? (aggregated.total_vods_processing / total) * 100 : 0;
  const failedPercent = total > 0 ? (aggregated.total_vods_failed / total) * 100 : 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Distribuição de Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              Prontos
            </span>
            <span className="font-medium">{aggregated.total_vods_ready} ({successPercent.toFixed(1)}%)</span>
          </div>
          <Progress value={successPercent} className="h-2 bg-muted" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              Processando
            </span>
            <span className="font-medium">{aggregated.total_vods_processing} ({processingPercent.toFixed(1)}%)</span>
          </div>
          <Progress value={processingPercent} className="h-2 bg-muted [&>div]:bg-yellow-500" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              Falhou
            </span>
            <span className="font-medium">{aggregated.total_vods_failed} ({failedPercent.toFixed(1)}%)</span>
          </div>
          <Progress value={failedPercent} className="h-2 bg-muted [&>div]:bg-red-500" />
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total de VODs</span>
            <span className="font-medium text-foreground">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CFStreamMetricsDashboard() {
  const [selectedRange, setSelectedRange] = useState("7d");
  const timeRangeDays = TIME_RANGES.find(r => r.value === selectedRange)?.days || 7;
  
  const { 
    channelMetrics, 
    aggregated, 
    isLoading, 
    refresh 
  } = useCFStreamAnalytics(timeRangeDays);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Métricas de Playback</h2>
          <p className="text-sm text-muted-foreground">
            Analytics do Cloudflare Stream
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="VODs Prontos"
          value={isLoading ? "-" : aggregated.total_vods_ready}
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard
          title="Taxa de Sucesso"
          value={isLoading ? "-" : `${aggregated.success_rate.toFixed(1)}%`}
          subtitle="uploads concluídos"
          icon={Percent}
          variant={aggregated.success_rate >= 80 ? "success" : aggregated.success_rate >= 50 ? "warning" : "error"}
        />
        <MetricCard
          title="Tempo Médio"
          value={isLoading ? "-" : `${aggregated.avg_processing_time_minutes.toFixed(1)}m`}
          subtitle="de processamento"
          icon={Zap}
        />
        <MetricCard
          title="Taxa de Retry"
          value={isLoading ? "-" : `${aggregated.retry_rate.toFixed(1)}%`}
          subtitle="uploads com retry"
          icon={RefreshCw}
          variant={aggregated.retry_rate <= 10 ? "success" : aggregated.retry_rate <= 30 ? "warning" : "error"}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Em Processamento"
          value={isLoading ? "-" : aggregated.total_vods_processing}
          icon={Activity}
          variant="warning"
        />
        <MetricCard
          title="Erros Totais"
          value={isLoading ? "-" : aggregated.total_errors}
          icon={AlertTriangle}
          variant={aggregated.total_errors === 0 ? "success" : "error"}
        />
        <MetricCard
          title="VODs com Falha"
          value={isLoading ? "-" : aggregated.total_vods_failed}
          icon={AlertTriangle}
          variant="error"
        />
        <MetricCard
          title="Bandwidth Total"
          value={isLoading ? "-" : `${aggregated.total_bandwidth_gb.toFixed(2)} GB`}
          icon={HardDrive}
        />
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Por Canal
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Métricas por Canal</CardTitle>
              <CardDescription>
                {channelMetrics.length} canais com dados disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChannelMetricsTable metrics={channelMetrics} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <div className="grid md:grid-cols-2 gap-4">
            <ProcessingStats aggregated={aggregated} isLoading={isLoading} />
            
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Processamento Médio</p>
                    <p className="text-xl font-bold">
                      {aggregated.avg_processing_time_minutes.toFixed(1)} min
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                    <p className="text-xl font-bold text-green-500">
                      {aggregated.success_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Retry Rate</p>
                    <p className={cn(
                      "text-xl font-bold",
                      aggregated.retry_rate <= 10 ? "text-green-500" : 
                      aggregated.retry_rate <= 30 ? "text-yellow-500" : "text-red-500"
                    )}>
                      {aggregated.retry_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Falhas</p>
                    <p className={cn(
                      "text-xl font-bold",
                      aggregated.total_vods_failed === 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {aggregated.total_vods_failed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
