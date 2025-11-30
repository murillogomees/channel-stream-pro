/**
 * Transcode Queue Dashboard
 * 
 * Admin dashboard for monitoring and managing transcode jobs.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Zap,
  BarChart3,
  ListVideo,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { 
  transcodeQueueService, 
  TranscodeJob, 
  TranscodeJobStatus,
  QueueStats,
} from '@/services/transcodeQueueService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG: Record<TranscodeJobStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  queued: { label: 'Na Fila', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'default', icon: Loader2 },
  ready: { label: 'Pronto', variant: 'outline', icon: CheckCircle },
  failed: { label: 'Falhou', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelado', variant: 'outline', icon: Pause },
};

export function TranscodeQueueDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [jobs, setJobs] = useState<TranscodeJob[]>([]);
  const [jobsCount, setJobsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TranscodeJobStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, jobsData] = await Promise.all([
        transcodeQueueService.getStats(),
        transcodeQueueService.listJobs({
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: pageSize,
          offset: currentPage * pageSize,
        }),
      ]);
      setStats(statsData);
      setJobs(jobsData.jobs);
      setJobsCount(jobsData.count);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, currentPage, toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTriggerProcessor = async () => {
    setIsProcessing(true);
    try {
      const result = await transcodeQueueService.triggerProcessor(5);
      toast({
        title: 'Processador executado',
        description: `Processados: ${result.processed}, Sucesso: ${result.succeeded}, Falhas: ${result.failed}`,
      });
      await fetchData();
    } catch (error) {
      toast({
        title: 'Erro ao executar processador',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await transcodeQueueService.retryJob(jobId);
      toast({ title: 'Job adicionado à fila novamente' });
      await fetchData();
    } catch (error) {
      toast({
        title: 'Erro ao reprocessar',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await transcodeQueueService.cancelJob(jobId);
      toast({ title: 'Job cancelado' });
      await fetchData();
    } catch (error) {
      toast({
        title: 'Erro ao cancelar',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const formatTime = (ms: number | null) => {
    if (!ms) return '-';
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)} min`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
    return `${ms} ms`;
  };

  const totalPages = Math.ceil(jobsCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ListVideo className="h-6 w-6 text-primary" />
            Fila de Transcodificação
          </h2>
          <p className="text-muted-foreground">
            Sistema de processamento de jobs com Cloudflare Stream
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            size="sm" 
            onClick={handleTriggerProcessor}
            disabled={isProcessing || !stats?.queued}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Processar Fila
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Na Fila</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.queued || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processando</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processing || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active_processors || 0} processadores ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prontos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ready || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(stats?.avg_processing_time_ms || null)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jobs</CardTitle>
              <CardDescription>
                {jobsCount} jobs encontrados
              </CardDescription>
            </div>
            <Select 
              value={statusFilter} 
              onValueChange={(v) => {
                setStatusFilter(v as TranscodeJobStatus | 'all');
                setCurrentPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="queued">Na Fila</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Preset</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const statusConfig = STATUS_CONFIG[job.status];
                const StatusIcon = statusConfig.icon;
                
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                        <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.channel_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.ladder_preset}</Badge>
                    </TableCell>
                    <TableCell>{job.priority}</TableCell>
                    <TableCell>
                      {job.retry_count}/{job.max_retries}
                      {job.error_message && (
                        <AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-1" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(job.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {['failed', 'cancelled'].includes(job.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRetryJob(job.id)}
                            title="Reprocessar"
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        )}
                        {['queued', 'processing'].includes(job.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancelJob(job.id)}
                            title="Cancelar"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum job encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {currentPage + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TranscodeQueueDashboard;
