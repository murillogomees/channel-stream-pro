/**
 * CDN Dashboard
 * 
 * Admin dashboard for monitoring and managing R2 CDN infrastructure:
 * - Storage statistics
 * - Prewarm jobs
 * - Token management
 * - Real-time metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  HardDrive, 
  Flame, 
  Key, 
  TrendingUp, 
  RefreshCw, 
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Activity,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import r2CdnService, { 
  CdnStats, 
  PrewarmJob, 
  PrewarmPrediction,
  R2StorageObject 
} from '@/services/r2CdnService';
import { CdnWorkerStatus } from './CdnWorkerStatus';

export function CdnDashboard() {
  const [stats, setStats] = useState<CdnStats | null>(null);
  const [prewarmJobs, setPrewarmJobs] = useState<PrewarmJob[]>([]);
  const [predictions, setPredictions] = useState<PrewarmPrediction[]>([]);
  const [recentObjects, setRecentObjects] = useState<R2StorageObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [prewarmLoading, setPrewarmLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, jobsData, predictionsData, objectsData] = await Promise.all([
        r2CdnService.getCdnStats(),
        r2CdnService.listPrewarmJobs({ limit: 10 }),
        r2CdnService.getPrewarmPredictions(20),
        r2CdnService.listR2Objects({ limit: 20 })
      ]);

      setStats(statsData);
      setPrewarmJobs(jobsData);
      setPredictions(predictionsData);
      setRecentObjects(objectsData.data);
    } catch (error) {
      console.error('[CDN Dashboard] Load error:', error);
      toast.error('Erro ao carregar dados do CDN');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleTriggerPrewarm = async () => {
    setPrewarmLoading(true);
    try {
      const result = await r2CdnService.triggerPrewarm({
        type: 'on_demand',
        max_assets: 50,
        segments_per_asset: 5
      });

      if (result.success) {
        toast.success('Job de prewarm iniciado');
        loadData();
      } else {
        toast.error(result.error || 'Erro ao iniciar prewarm');
      }
    } catch (error) {
      toast.error('Erro ao iniciar prewarm');
    } finally {
      setPrewarmLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      ready: { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
      completed: { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
      running: { variant: 'secondary', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
      pending: { variant: 'outline', icon: <Clock className="w-3 h-3" /> },
      failed: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
      uploading: { variant: 'secondary', icon: <RefreshCw className="w-3 h-3 animate-spin" /> }
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CDN Dashboard</h2>
          <p className="text-muted-foreground">
            Cloudflare R2 Storage & Edge Cache Management
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleTriggerPrewarm}
            disabled={prewarmLoading}
          >
            <Flame className="w-4 h-4 mr-2" />
            Prewarm Agora
          </Button>
        </div>
      </div>

      {/* CDN Worker Status */}
      <CdnWorkerStatus />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              Armazenamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_size_gb?.toFixed(2) || 0} GB
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_objects || 0} objetos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Acessos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.total_access_count || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_bandwidth_gb?.toFixed(2) || 0} GB transferidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
              Tokens Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.active_tokens || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              JWT signed manifests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              Prewarm Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.prewarm_jobs_today || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              jobs executados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="prewarm" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prewarm">
            <Flame className="w-4 h-4 mr-2" />
            Prewarm
          </TabsTrigger>
          <TabsTrigger value="predictions">
            <TrendingUp className="w-4 h-4 mr-2" />
            Predições
          </TabsTrigger>
          <TabsTrigger value="storage">
            <Database className="w-4 h-4 mr-2" />
            Storage
          </TabsTrigger>
        </TabsList>

        {/* Prewarm Jobs Tab */}
        <TabsContent value="prewarm">
          <Card>
            <CardHeader>
              <CardTitle>Jobs de Prewarm</CardTitle>
              <CardDescription>
                Histórico de jobs de pré-aquecimento do cache de borda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {prewarmJobs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum job de prewarm encontrado
                    </p>
                  ) : (
                    prewarmJobs.map((job) => (
                      <div 
                        key={job.id} 
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(job.status)}
                            <Badge variant="outline">{job.job_type}</Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(job.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Assets:</span>
                            <span className="ml-2 font-medium">
                              {job.prewarmed_assets}/{job.total_assets}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Falhas:</span>
                            <span className="ml-2 font-medium text-destructive">
                              {job.failed_assets}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Bytes:</span>
                            <span className="ml-2 font-medium">
                              {formatBytes(job.total_bytes_prewarmed)}
                            </span>
                          </div>
                        </div>

                        {job.status === 'running' && (
                          <Progress 
                            value={(job.prewarmed_assets / job.total_assets) * 100} 
                          />
                        )}

                        {job.avg_prewarm_time_ms && (
                          <p className="text-xs text-muted-foreground">
                            Tempo médio: {job.avg_prewarm_time_ms}ms por asset
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions">
          <Card>
            <CardHeader>
              <CardTitle>Predições de Visualização</CardTitle>
              <CardDescription>
                Assets priorizados para prewarm baseado em histórico de views
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {predictions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma predição disponível
                    </p>
                  ) : (
                    predictions.map((pred, index) => (
                      <div 
                        key={pred.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[300px]">
                              {pred.r2_key || pred.channel_id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              7d: {pred.views_7d} views | 30d: {pred.views_30d} views
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="font-medium">{pred.predicted_views}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            previsto
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle>Objetos R2</CardTitle>
              <CardDescription>
                Conteúdo armazenado no Cloudflare R2
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {recentObjects.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum objeto encontrado
                    </p>
                  ) : (
                    recentObjects.map((obj) => (
                      <div 
                        key={obj.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusBadge(obj.status)}
                          <div>
                            <p className="font-medium text-sm truncate max-w-[300px]">
                              {obj.r2_key}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {obj.content_type} | {formatBytes(obj.size_bytes || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p>{obj.access_count.toLocaleString()} acessos</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(obj.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CdnDashboard;
