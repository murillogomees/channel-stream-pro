import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Film, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  TrendingUp,
  Activity,
  DollarSign,
  Timer,
  Percent
} from 'lucide-react';
import { StreamStatistics } from '@/services/cloudflareStreamService';

interface CloudflareStreamStatsProps {
  statistics: StreamStatistics | null;
  loading?: boolean;
}

export function CloudflareStreamStats({ statistics, loading }: CloudflareStreamStatsProps) {
  if (!statistics) {
    return null;
  }

  const successRate = statistics.success_rate || 0;
  const activeUploads = (statistics.uploads_queued || 0) + 
                        (statistics.uploads_processing || 0) + 
                        (statistics.uploads_uploading || 0) +
                        (statistics.uploads_retry_scheduled || 0);

  return (
    <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
      {/* VODs no Stream */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">VODs no Stream</CardDescription>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Film className="w-5 h-5 text-emerald-400" />
            {statistics.vods_on_stream?.toLocaleString() || 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            de {statistics.total_vods?.toLocaleString() || 0} VODs
          </div>
          {statistics.total_vods > 0 && (
            <Progress 
              value={(statistics.vods_on_stream / statistics.total_vods) * 100} 
              className="mt-2 h-1.5"
            />
          )}
        </CardContent>
      </Card>

      {/* Em Processamento */}
      <Card className={activeUploads > 0 ? 'ring-1 ring-blue-500/30' : ''}>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Ativos</CardDescription>
          <CardTitle className="text-2xl flex items-center gap-2">
            {activeUploads > 0 ? (
              <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            ) : (
              <Clock className="w-5 h-5 text-blue-400" />
            )}
            {activeUploads}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Fila:</span>
              <span>{statistics.uploads_queued || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Processando:</span>
              <span>{statistics.uploads_processing || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Retry:</span>
              <span className="text-yellow-400">{statistics.uploads_retry_scheduled || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Sucesso */}
      <Card className={successRate < 80 ? 'ring-1 ring-yellow-500/30' : ''}>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Taxa de Sucesso</CardDescription>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Percent className={`w-5 h-5 ${
              successRate >= 90 ? 'text-emerald-400' :
              successRate >= 70 ? 'text-yellow-400' :
              'text-red-400'
            }`} />
            {successRate?.toFixed(1) || 0}%
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Sucesso:</span>
              <span className="text-emerald-400">{statistics.uploads_ready || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Erros:</span>
              <span className="text-red-400">{statistics.uploads_error || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Últimas 24h */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Últimas 24h</CardDescription>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Timer className="w-5 h-5 text-purple-400" />
            {statistics.uploads_last_24h || 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Erros 24h:</span>
              <span className="text-red-400">{statistics.errors_last_24h || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Retries:</span>
              <span>{statistics.avg_retry_count?.toFixed(1) || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custo */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Custo Estimado</CardDescription>
          <CardTitle className="text-2xl flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            ${statistics.estimated_monthly_cost?.toFixed(2) || '0.00'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Horas:</span>
              <span>{statistics.total_duration_hours?.toLocaleString() || 0}h</span>
            </div>
            <div className="flex justify-between">
              <span>Max retries:</span>
              <span className="text-red-400">{statistics.max_retry_reached || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CloudflareStreamStats;
