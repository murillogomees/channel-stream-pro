/**
 * QoS Dashboard Component - System health and performance monitoring
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Wifi, 
  Server, 
  Database, 
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';
import { useQoS } from '../hooks/useQoS';
import type { HealthStatus } from '../types';

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'online':
    case 'healthy':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'offline':
    case 'critical':
    case 'unknown':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const variant = status === 'online' || status === 'healthy' 
    ? 'default' 
    : status === 'degraded' 
      ? 'secondary' 
      : 'destructive';
  
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
};

export function QoSDashboard() {
  const { 
    health, 
    cdnStats, 
    activeStreams, 
    channelHealth,
    isLoading, 
    refresh 
  } = useQoS(true, 30000);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onlineChannels = channelHealth.filter(ch => ch.status === 'online').length;
  const totalChannels = channelHealth.length;
  const healthPercentage = totalChannels > 0 ? (onlineChannels / totalChannels) * 100 : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">QoS Dashboard</h2>
          <p className="text-muted-foreground">Monitoramento de qualidade e saúde do sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Status Geral</span>
              </div>
              <StatusIcon status={health?.overall || 'healthy'} />
            </div>
            <div className="mt-2">
              <StatusBadge status={health?.overall || 'healthy'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">CDN</span>
              </div>
              <StatusIcon status={health?.cdn || 'online'} />
            </div>
            <div className="mt-2">
              <StatusBadge status={health?.cdn || 'online'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Streaming</span>
              </div>
              <StatusIcon status={health?.streaming || 'online'} />
            </div>
            <div className="mt-2">
              <StatusBadge status={health?.streaming || 'online'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Database</span>
              </div>
              <StatusIcon status={health?.database || 'online'} />
            </div>
            <div className="mt-2">
              <StatusBadge status={health?.database || 'online'} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              CDN Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cdnStats?.hitRate.toFixed(1) || 0}%</div>
            <Progress value={cdnStats?.hitRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Latência Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cdnStats?.latency.toFixed(0) || 0}ms</div>
            <p className="text-xs text-muted-foreground mt-1">Tempo de resposta CDN</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Streams Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStreams?.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(activeStreams?.bandwidth || 0)}/s estimado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Canais Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineChannels}/{totalChannels}
            </div>
            <Progress value={healthPercentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* CDN Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas CDN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Bandwidth Economizado</p>
              <p className="text-xl font-semibold">{formatBytes(cdnStats?.bandwidth || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
              <p className="text-xl font-semibold">{cdnStats?.hitRate.toFixed(1) || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Latência Média</p>
              <p className="text-xl font-semibold">{cdnStats?.latency.toFixed(0) || 0}ms</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Erros</p>
              <p className="text-xl font-semibold text-red-500">{cdnStats?.errors || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Health Table */}
      {channelHealth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saúde dos Canais (Top 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {channelHealth.slice(0, 20).map((ch) => (
                <div 
                  key={ch.channel_id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <StatusIcon status={ch.status} />
                    <span className="text-sm font-mono truncate max-w-[200px]">
                      {ch.channel_id.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {ch.uptime_percentage.toFixed(1)}% uptime
                    </span>
                    <StatusBadge status={ch.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QoSDashboard;
