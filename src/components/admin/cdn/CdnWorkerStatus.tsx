/**
 * CDN Worker Status Card
 * 
 * Displays real-time status of the Cloudflare CDN Worker
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp,
  Clock,
  Radio
} from 'lucide-react';
import { 
  cdnRoutingService, 
  CdnWorkerHealth,
  RoutingMetrics 
} from '@/services/cdnRoutingService';

export function CdnWorkerStatus() {
  const [health, setHealth] = useState<CdnWorkerHealth | null>(null);
  const [metrics, setMetrics] = useState<RoutingMetrics | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const checkHealth = async () => {
    setChecking(true);
    try {
      const healthData = await cdnRoutingService.checkCdnWorkerHealth();
      const metricsData = cdnRoutingService.getRoutingMetrics();
      
      setHealth(healthData);
      setMetrics(metricsData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[CDN Worker Status] Check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(checkHealth, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'degraded': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'down': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertCircle className="h-4 w-4" />;
      case 'down': return <AlertCircle className="h-4 w-4" />;
      default: return <Radio className="h-4 w-4" />;
    }
  };

  const formatTimeSince = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s atrás`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
    return `${Math.floor(seconds / 3600)}h atrás`;
  };

  if (!health || !metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Verificando CDN Worker...</span>
        </CardContent>
      </Card>
    );
  }

  const totalRequests = metrics.cdn_worker_requests + metrics.stream_proxy_requests;
  const cdnWorkerPercentage = totalRequests > 0 
    ? Math.round((metrics.cdn_worker_requests / totalRequests) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>CDN Worker Status</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={checkHealth}
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(health.status)}>
              {getStatusIcon(health.status)}
              <span className="ml-1 capitalize">{health.status}</span>
            </Badge>
            
            {health.responseTime && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {health.responseTime}ms
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {formatTimeSince(lastUpdate)}
          </div>
        </div>

        {/* Error Message */}
        {health.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="inline h-4 w-4 mr-2" />
            {health.error}
          </div>
        )}

        {/* Routing Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">CDN Worker</div>
            <div className="text-2xl font-bold">{metrics.cdn_worker_requests}</div>
            <div className="text-xs text-muted-foreground">
              {cdnWorkerPercentage}% do tráfego
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Stream Proxy</div>
            <div className="text-2xl font-bold">{metrics.stream_proxy_requests}</div>
            <div className="text-xs text-muted-foreground">
              {totalRequests > 0 ? 100 - cdnWorkerPercentage : 0}% do tráfego
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Fallbacks
            </div>
            <div className="text-2xl font-bold">{metrics.fallback_count}</div>
            <div className="text-xs text-muted-foreground">
              {totalRequests > 0 
                ? `${Math.round((metrics.fallback_count / totalRequests) * 100)}% taxa`
                : '0% taxa'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Requests</div>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <div className="text-xs text-muted-foreground">
              Desde inicialização
            </div>
          </div>
        </div>

        {/* Performance Indicator */}
        {health.status === 'healthy' && cdnWorkerPercentage > 0 && (
          <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="inline h-4 w-4 mr-2" />
            CDN Worker está otimizando {cdnWorkerPercentage}% do tráfego
          </div>
        )}

        {health.status === 'degraded' && (
          <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="inline h-4 w-4 mr-2" />
            Latência elevada detectada. Sistema está funcionando com degradação.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CdnWorkerStatus;
