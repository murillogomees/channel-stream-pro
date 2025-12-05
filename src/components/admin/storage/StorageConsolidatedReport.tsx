import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStorageConsolidatedReport } from '@/hooks/useStorageConsolidatedReport';
import { StorageCostEstimator } from './StorageCostEstimator';
import { StorageEvolutionChart } from './StorageEvolutionChart';
import { StorageSyncHistory } from './StorageSyncHistory';
import { HardDrive, Cloud, Database, RefreshCw, TrendingUp, DollarSign, Activity, Zap } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function StorageConsolidatedReport() {
  const { report, config, isLoading, error, refresh, updateConfig } = useStorageConsolidatedReport();

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar relatório: {error}</p>
          <Button onClick={refresh} className="mt-4">Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Relatório Consolidado de Storage
          </h2>
          <p className="text-sm text-muted-foreground">
            Visão unificada do R2 + Cloudflare Stream
          </p>
        </div>
        <Button onClick={refresh} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* R2 Storage */}
        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-orange-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-orange-500" />
              Cloudflare R2
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold text-orange-500">
                  {formatBytes(report?.summary.r2_total_bytes || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report?.summary.r2_object_count || 0} objetos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* CF Stream */}
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Cloudflare Stream
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold text-blue-500">
                  {formatBytes(report?.summary.cf_total_bytes || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report?.summary.cf_object_count || 0} vídeos • {(report?.summary.cf_total_minutes || 0).toFixed(0)} min
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Combined Total */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Total Combinado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold text-primary">
                  {formatBytes(report?.summary.combined_total_bytes || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report?.summary.combined_object_count || 0} objetos total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Monthly Cost */}
        <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-green-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Custo Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-500">
                  ${report?.costs.total_monthly.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ~${report?.costs.projected_annual.toFixed(0) || '0'}/ano
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Auto-Sync Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Configuração de Auto-Sync
          </CardTitle>
          <CardDescription>
            Controle a sincronização automática R2 → CF Stream
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Auto-Transcode:</span>
              <Badge 
                variant={config.auto_transcode_enabled ? 'default' : 'secondary'}
                className="cursor-pointer"
                onClick={() => updateConfig('auto_transcode_enabled', { enabled: !config.auto_transcode_enabled })}
              >
                {config.auto_transcode_enabled ? 'Ativo' : 'Desativado'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Preset:</span>
              <Badge variant="outline">{config.transcode_preset}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Alerta de Custo:</span>
              <Badge variant="outline">${config.monthly_alert_threshold}/mês</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <StorageEvolutionChart 
          data={report?.monthly_evolution || []} 
          isLoading={isLoading} 
        />

        {/* Cost Breakdown */}
        <StorageCostEstimator 
          costs={report?.costs} 
          isLoading={isLoading} 
        />
      </div>

      {/* Sync History */}
      <StorageSyncHistory 
        syncs={report?.recent_syncs || []} 
        isLoading={isLoading} 
      />
    </div>
  );
}
