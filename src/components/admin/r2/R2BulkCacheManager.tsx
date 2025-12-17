import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  HardDrive,
  Download,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkCacheJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  success_items: number;
  failed_items: number;
  skipped_items: number;
  current_batch: number;
  batch_size: number;
  content_filter: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface CacheStats {
  totalCached: number;
  totalVodChannels: number;
  cachePercentage: number;
}

export function R2BulkCacheManager() {
  const [jobs, setJobs] = useState<BulkCacheJob[]>([]);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('r2-bulk-cache', {
        body: { action: 'status' }
      });

      if (error) throw error;

      setJobs(data.jobs || []);
      setStats(data.stats || null);
    } catch (error: any) {
      console.error('Failed to fetch status:', error);
      toast.error('Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const startBulkCache = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('r2-bulk-cache', {
        body: { action: 'start', contentFilter: 'vod' }
      });

      if (error) throw error;

      toast.success('Job de cache iniciado');
      setCurrentJobId(data.jobId);
      
      if (data.hasMore && autoMode) {
        continueBulkCache(data.jobId);
      } else {
        fetchStatus();
      }
    } catch (error: any) {
      console.error('Failed to start bulk cache:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const continueBulkCache = async (jobId: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('r2-bulk-cache', {
        body: { action: 'continue', jobId }
      });

      if (error) throw error;

      if (data.status === 'completed') {
        toast.success('Cache completo!');
        setAutoMode(false);
      } else if (data.hasMore && autoMode) {
        // Continue automatically
        setTimeout(() => continueBulkCache(jobId), 1000);
      } else {
        toast.info(`Batch processado: ${data.success} sucessos, ${data.failed} falhas`);
      }

      fetchStatus();
    } catch (error: any) {
      console.error('Failed to continue bulk cache:', error);
      toast.error(`Erro: ${error.message}`);
      setAutoMode(false);
    } finally {
      setProcessing(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase.functions.invoke('r2-bulk-cache', {
        body: { action: 'cancel', jobId }
      });

      if (error) throw error;

      toast.success('Job cancelado');
      setAutoMode(false);
      fetchStatus();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const toggleAutoMode = () => {
    const newAutoMode = !autoMode;
    setAutoMode(newAutoMode);
    
    if (newAutoMode) {
      const runningJob = jobs.find(j => j.status === 'running');
      if (runningJob) {
        continueBulkCache(runningJob.id);
      } else {
        startBulkCache();
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Executando</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completo</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Falhou</Badge>;
      case 'cancelled':
        return <Badge variant="secondary"><Pause className="w-3 h-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return '-';
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const runningJob = jobs.find(j => j.status === 'running');

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            R2 Bulk Cache - VOD
          </CardTitle>
          <CardDescription>
            Baixar todo conteúdo VOD para Cloudflare R2 (batches de 50)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{stats.totalCached}</div>
                <div className="text-sm text-muted-foreground">Cacheados</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{stats.totalVodChannels}</div>
                <div className="text-sm text-muted-foreground">Total VOD</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{stats.cachePercentage}%</div>
                <div className="text-sm text-muted-foreground">Progresso</div>
              </div>
            </div>
          )}

          <Progress value={stats?.cachePercentage || 0} className="h-3" />

          <div className="flex gap-2">
            {!runningJob ? (
              <Button onClick={startBulkCache} disabled={processing}>
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Iniciar Cache
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => continueBulkCache(runningJob.id)} 
                  disabled={processing || autoMode}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Próximo Batch
                </Button>
                <Button 
                  variant={autoMode ? "destructive" : "outline"}
                  onClick={toggleAutoMode}
                >
                  {autoMode ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Parar Auto
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Modo Auto
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => cancelJob(runningJob.id)}
                  disabled={processing}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={fetchStatus}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {autoMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm">Modo automático ativo - processando batches continuamente</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Running Job Details */}
      {runningJob && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job em Execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Processados</div>
                <div className="text-xl font-semibold">{runningJob.processed_items} / {runningJob.total_items}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sucessos</div>
                <div className="text-xl font-semibold text-green-500">{runningJob.success_items}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Falhas</div>
                <div className="text-xl font-semibold text-red-500">{runningJob.failed_items}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Duração</div>
                <div className="text-xl font-semibold">{formatDuration(runningJob.started_at)}</div>
              </div>
            </div>
            <Progress 
              value={runningJob.total_items > 0 ? (runningJob.processed_items / runningJob.total_items) * 100 : 0} 
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Jobs History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum job encontrado
              </div>
            ) : (
              jobs.map(job => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    {getStatusBadge(job.status)}
                    <div>
                      <div className="text-sm font-medium">
                        {job.success_items} / {job.total_items} items
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {job.failed_items > 0 && (
                      <div className="flex items-center gap-1 text-red-500 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {job.failed_items} falhas
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(job.started_at, job.completed_at)}
                    </div>
                    {job.status === 'running' && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => continueBulkCache(job.id)}
                        disabled={processing}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
