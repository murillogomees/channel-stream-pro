/**
 * Ingest Metrics Dashboard
 * 
 * Real-time observability dashboard for M3U ingest operations.
 * Shows success rates, bytes transferred, method distribution, and error rates.
 * 
 * @version 1.0.0
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Cloud, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HardDrive,
  RefreshCw,
  TrendingUp,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface MetricsSummary {
  hour: string;
  total_requests: number;
  successful: number;
  failed: number;
  avg_bytes: number;
  avg_duration_ms: number;
  total_bytes: number;
  error_rate_pct: number;
  stream_count: number;
  signed_url_count: number;
  fallback_count: number;
  avg_retries: number;
}

export function IngestMetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('vw_ingest_metrics_summary')
        .select('*')
        .limit(24);

      if (error) throw error;
      setMetrics((data || []) as MetricsSummary[]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[IngestMetrics] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Aggregate totals
  const totals = metrics.reduce((acc, m) => ({
    requests: acc.requests + (m.total_requests || 0),
    successful: acc.successful + (m.successful || 0),
    failed: acc.failed + (m.failed || 0),
    bytes: acc.bytes + (m.total_bytes || 0),
    stream: acc.stream + (m.stream_count || 0),
    signedUrl: acc.signedUrl + (m.signed_url_count || 0),
    fallback: acc.fallback + (m.fallback_count || 0),
  }), { requests: 0, successful: 0, failed: 0, bytes: 0, stream: 0, signedUrl: 0, fallback: 0 });

  const successRate = totals.requests > 0 
    ? ((totals.successful / totals.requests) * 100).toFixed(1)
    : '100';

  const avgDuration = metrics.length > 0
    ? (metrics.reduce((sum, m) => sum + (m.avg_duration_ms || 0), 0) / metrics.length).toFixed(0)
    : '0';

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Métricas de Ingest
          </h3>
          <p className="text-sm text-muted-foreground">
            Últimas 24 horas de operações de ingest M3U
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{totals.requests}</p>
              </div>
              <Cloud className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-green-600">{successRate}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
            <Progress value={parseFloat(successRate)} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bytes Transferidos</p>
                <p className="text-2xl font-bold">{formatBytes(totals.bytes)}</p>
              </div>
              <HardDrive className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Duração Média</p>
                <p className="text-2xl font-bold">{avgDuration}ms</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Method Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Distribuição por Método
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{totals.stream}</p>
              <p className="text-xs text-muted-foreground">Streaming</p>
              <Badge variant="default" className="mt-1">
                {totals.requests > 0 
                  ? ((totals.stream / totals.requests) * 100).toFixed(0) 
                  : 0}%
              </Badge>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <p className="text-2xl font-bold">{totals.signedUrl}</p>
              <p className="text-xs text-muted-foreground">Signed URL</p>
              <Badge variant="secondary" className="mt-1">
                {totals.requests > 0 
                  ? ((totals.signedUrl / totals.requests) * 100).toFixed(0) 
                  : 0}%
              </Badge>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-500/10">
              <p className="text-2xl font-bold text-orange-600">{totals.fallback}</p>
              <p className="text-xs text-muted-foreground">Fallback</p>
              <Badge variant="outline" className="mt-1">
                {totals.requests > 0 
                  ? ((totals.fallback / totals.requests) * 100).toFixed(0) 
                  : 0}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Rate Alert */}
      {totals.failed > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {totals.failed} falhas detectadas
                </p>
                <p className="text-sm text-muted-foreground">
                  Taxa de erro: {((totals.failed / totals.requests) * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Atividade por Hora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {metrics.slice(0, 12).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">
                    {new Date(m.hour).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {m.total_requests} req
                    </Badge>
                    <span className="text-green-600">{m.successful} ✓</span>
                    {m.failed > 0 && (
                      <span className="text-destructive">{m.failed} ✗</span>
                    )}
                    <span className="text-muted-foreground">
                      {formatBytes(m.total_bytes || 0)}
                    </span>
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
