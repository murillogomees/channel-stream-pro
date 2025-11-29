import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, FileText, Filter, Search, RefreshCw, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncJob {
  id: string;
  source_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  entries_count?: number;
  new_entries?: number;
  updated_entries?: number;
  removed_entries?: number;
  invalid_entries_count?: number;
  file_size_bytes?: number;
  error_message?: string;
  source_name?: string;
}

export default function AdminM3UImportHistory() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<SyncJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('m3u_sync_jobs')
        .select(`
          *,
          m3u_sync_sources!inner(name)
        `)
        .order('started_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'completed' | 'failed' | 'running' | 'pending' | 'partial');
      }

      const { data, error } = await query;
      if (error) throw error;

      setJobs((data || []).map(j => ({
        ...j,
        source_name: j.m3u_sync_sources?.name
      })));
    } catch (error) {
      console.error('Error loading sync jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'running':
        return <Badge variant="outline" className="animate-pulse">Processando</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const filteredJobs = jobs.filter(job =>
    searchQuery === '' ||
    job.source_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    totalEntries: jobs.reduce((acc, j) => acc + (j.entries_count || 0), 0),
    avgDuration: jobs.length > 0 
      ? Math.round(jobs.reduce((acc, j) => acc + (j.duration_ms || 0), 0) / jobs.length)
      : 0
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-semibold">Histórico de Sincronizações</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Timeline de jobs de sincronização M3U</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Sucesso</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Falhas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-red-500">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Entradas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{stats.totalEntries.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{formatDuration(stats.avgDuration)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por fonte..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px] h-9">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Sucesso</SelectItem>
            <SelectItem value="running">Processando</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Jobs List */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Jobs de Sincronização</CardTitle>
            <CardDescription className="text-xs">{filteredJobs.length} job(s)</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <ScrollArea className="h-[400px] sm:h-[500px] pr-2">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                ) : filteredJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum job encontrado</p>
                ) : (
                  filteredJobs.map((job) => (
                    <Card
                      key={job.id}
                      className={`cursor-pointer transition-all hover:bg-muted/50 ${selectedJob?.id === job.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedJob(job)}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{job.source_name || 'Fonte desconhecida'}</h4>
                              <p className="text-xs text-muted-foreground">
                                {job.entries_count?.toLocaleString() || 0} entradas
                              </p>
                            </div>
                            {getStatusBadge(job.status)}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(job.duration_ms)}
                            </span>
                            {job.file_size_bytes && (
                              <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {formatBytes(job.file_size_bytes)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(job.started_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </span>
                          </div>

                          {job.error_message && (
                            <p className="text-xs text-destructive truncate flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {job.error_message}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Detalhes do Job</CardTitle>
            <CardDescription className="text-xs">
              {selectedJob ? 'Informações detalhadas' : 'Selecione um job'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            {!selectedJob ? (
              <div className="flex items-center justify-center h-[400px] sm:h-[500px] text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Selecione um job para ver detalhes</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status Header */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {selectedJob.status === 'completed' ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : selectedJob.status === 'failed' ? (
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  ) : (
                    <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                  )}
                  <div>
                    <h3 className="font-semibold">{selectedJob.source_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(selectedJob.started_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Total Entradas</p>
                      <p className="text-lg font-bold">{selectedJob.entries_count?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Duração</p>
                      <p className="text-lg font-bold">{formatDuration(selectedJob.duration_ms)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground text-green-500">Novas</p>
                      <p className="text-lg font-bold text-green-500">{selectedJob.new_entries?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground text-blue-500">Atualizadas</p>
                      <p className="text-lg font-bold text-blue-500">{selectedJob.updated_entries?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground text-red-500">Removidas</p>
                      <p className="text-lg font-bold text-red-500">{selectedJob.removed_entries?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground text-yellow-500">Inválidas</p>
                      <p className="text-lg font-bold text-yellow-500">{selectedJob.invalid_entries_count?.toLocaleString() || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* File Size */}
                {selectedJob.file_size_bytes && (
                  <Card>
                    <CardContent className="p-3 flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tamanho do Arquivo</p>
                        <p className="font-medium">{formatBytes(selectedJob.file_size_bytes)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timestamps */}
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Iniciado</span>
                      <span>{format(new Date(selectedJob.started_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</span>
                    </div>
                    {selectedJob.completed_at && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Concluído</span>
                        <span>{format(new Date(selectedJob.completed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Error */}
                {selectedJob.error_message && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">Erro</p>
                      <p className="text-sm text-destructive">{selectedJob.error_message}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
