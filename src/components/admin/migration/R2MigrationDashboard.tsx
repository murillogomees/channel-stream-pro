import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Play, Pause, Square, RefreshCw, Download, AlertTriangle, 
  CheckCircle2, XCircle, Clock, Database, Cloud, Zap,
  BarChart3, Settings, History, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MigrationStats {
  sync_entries: { total: number; synced: number; pending: number };
  channels: { total: number; synced: number; pending: number };
  playlist_entries: { total: number; synced: number; pending: number };
  jobs: { total: number; running: number; completed: number; failed: number };
  failed_items: number;
  last_updated: string;
}

interface MigrationJob {
  id: string;
  job_type: string;
  target_table: string;
  batch_size: number;
  concurrency: number;
  status: string;
  total_items: number;
  processed_items: number;
  success_items: number;
  failed_items: number;
  skipped_items: number;
  avg_duration_ms: number;
  throughput_per_min: number;
  started_at: string;
  finished_at: string;
  error_summary: any;
  created_at: string;
}

interface MigrationLog {
  id: number;
  item_table: string;
  item_id: string;
  from_url: string;
  to_path: string;
  status: string;
  duration_ms: number;
  error: string;
  created_at: string;
}

export function R2MigrationDashboard() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<MigrationJob | null>(null);
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Config
  const [targetTable, setTargetTable] = useState<string>('m3u_sync_entries');
  const [batchSize, setBatchSize] = useState(100);
  const [concurrency, setConcurrency] = useState(8);
  const [dryRun, setDryRun] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('r2-migration-worker', {
        body: { action: 'stats' },
      });
      
      if (error) throw error;
      if (data?.stats) setStats(data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('r2_migration_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  }, []);

  const loadLogs = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('r2-migration-worker', {
        body: { action: 'logs', jobId, limit: 100 },
      });
      
      if (error) throw error;
      setLogs(data?.logs || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadJobs();
    
    const interval = setInterval(() => {
      loadStats();
      loadJobs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadStats, loadJobs]);

  useEffect(() => {
    if (selectedJob) {
      loadLogs(selectedJob.id);
    }
  }, [selectedJob, loadLogs]);

  const startMigration = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('r2-migration-worker', {
        body: { 
          action: 'start', 
          targetTable, 
          batchSize, 
          concurrency,
          dryRun 
        },
      });
      
      if (error) throw error;
      
      toast.success(`Migration started: ${data.jobId}`);
      loadJobs();
    } catch (error) {
      toast.error('Failed to start migration');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const controlJob = async (action: 'pause' | 'resume' | 'cancel', jobId: string) => {
    try {
      const { error } = await supabase.functions.invoke('r2-migration-worker', {
        body: { action, jobId },
      });
      
      if (error) throw error;
      
      toast.success(`Job ${action}d`);
      loadJobs();
    } catch (error) {
      toast.error(`Failed to ${action} job`);
    }
  };

  const retryFailed = async (jobId: string) => {
    try {
      const { error } = await supabase.functions.invoke('r2-migration-worker', {
        body: { action: 'retry_failed', jobId },
      });
      
      if (error) throw error;
      
      toast.success('Failed items queued for retry');
    } catch (error) {
      toast.error('Failed to retry');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'running': return 'bg-blue-500/20 text-blue-400';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getProgressPercent = (job: MigrationJob) => {
    if (!job.total_items) return 0;
    return Math.round((job.processed_items / job.total_items) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Sync Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sync_entries.synced.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              de {stats?.sync_entries.total.toLocaleString() || 0} ({stats?.sync_entries.pending.toLocaleString() || 0} pendentes)
            </p>
            <Progress 
              value={stats ? (stats.sync_entries.synced / Math.max(stats.sync_entries.total, 1)) * 100 : 0} 
              className="h-1 mt-2" 
            />
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4 text-blue-400" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.channels.synced.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              de {stats?.channels.total.toLocaleString() || 0} ({stats?.channels.pending.toLocaleString() || 0} pendentes)
            </p>
            <Progress 
              value={stats ? (stats.channels.synced / Math.max(stats.channels.total, 1)) * 100 : 0} 
              className="h-1 mt-2" 
            />
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              Jobs Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.jobs.running || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.jobs.completed || 0} completed, {stats?.jobs.failed || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Failed Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed_items || 0}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando retry
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Start Migration Card */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Iniciar Migração</CardTitle>
              <CardDescription>
                Configure e inicie uma nova migração para R2
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tabela Alvo</Label>
                  <Select value={targetTable} onValueChange={setTargetTable}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m3u_sync_entries">M3U Sync Entries</SelectItem>
                      <SelectItem value="m3u_channels">M3U Channels</SelectItem>
                      <SelectItem value="playlist_entries">Playlist Entries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
                    min={10}
                    max={1000}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Concurrency</Label>
                  <Input
                    type="number"
                    value={concurrency}
                    onChange={(e) => setConcurrency(parseInt(e.target.value) || 8)}
                    min={1}
                    max={32}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dry Run</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={dryRun} onCheckedChange={setDryRun} />
                    <span className="text-sm text-muted-foreground">
                      {dryRun ? 'Simulação' : 'Produção'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={startMigration} 
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {dryRun ? 'Simular Migração' : 'Iniciar Migração'}
                </Button>
                
                <Button variant="outline" onClick={() => { loadStats(); loadJobs(); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Jobs */}
          {jobs.filter(j => j.status === 'running').map((job) => (
            <Card key={job.id} className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {job.target_table}
                      <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Job ID: {job.id.slice(0, 8)}...
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => controlJob('pause', job.id)}
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => controlJob('cancel', job.id)}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Progresso: {job.processed_items.toLocaleString()} / {job.total_items.toLocaleString()}</span>
                    <span>{getProgressPercent(job)}%</span>
                  </div>
                  <Progress value={getProgressPercent(job)} />
                  
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Sucesso</div>
                      <div className="text-green-400 font-medium">{job.success_items.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Falhas</div>
                      <div className="text-red-400 font-medium">{job.failed_items.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Skipped</div>
                      <div className="text-yellow-400 font-medium">{job.skipped_items.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Throughput</div>
                      <div className="font-medium">{Math.round(job.throughput_per_min)}/min</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="jobs">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Histórico de Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Sucesso/Falha</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">
                          {job.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{job.target_table}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={getProgressPercent(job)} className="w-20 h-2" />
                            <span className="text-xs">{getProgressPercent(job)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-400">{job.success_items}</span>
                          {' / '}
                          <span className="text-red-400">{job.failed_items}</span>
                        </TableCell>
                        <TableCell>
                          {job.started_at && job.finished_at 
                            ? `${Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
                            : job.started_at
                              ? 'Em andamento'
                              : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {job.status === 'paused' && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => controlJob('resume', job.id)}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            {job.failed_items > 0 && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => retryFailed(job.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedJob(job);
                                setActiveTab('logs');
                              }}
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Logs de Migração</CardTitle>
                {selectedJob && (
                  <Badge className={getStatusColor(selectedJob.status)}>
                    {selectedJob.id.slice(0, 8)}... - {selectedJob.target_table}
                  </Badge>
                )}
              </div>
              <CardDescription>
                {selectedJob 
                  ? `Mostrando logs do job ${selectedJob.id.slice(0, 8)}...`
                  : 'Selecione um job para ver os logs'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedJob ? (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Item ID</TableHead>
                        <TableHead>From URL</TableHead>
                        <TableHead>To Path</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                            {log.status === 'failed' && <XCircle className="h-4 w-4 text-red-400" />}
                            {log.status === 'skipped' && <Clock className="h-4 w-4 text-yellow-400" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.item_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {log.from_url || '-'}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {log.to_path || '-'}
                          </TableCell>
                          <TableCell>{log.duration_ms}ms</TableCell>
                          <TableCell className="text-xs text-red-400 max-w-[200px] truncate">
                            {log.error || '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p>Selecione um job na aba "Jobs" para ver os logs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Configuração da Migração</CardTitle>
              <CardDescription>
                Feature flags e configurações avançadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Feature Flags</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>USE_R2_STORAGE</Label>
                      <p className="text-xs text-muted-foreground">Ativar leitura via R2</p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>MIGRATION_ENABLED</Label>
                      <p className="text-xs text-muted-foreground">Permitir novas migrações</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>THROTTLE_ENABLED</Label>
                      <p className="text-xs text-muted-foreground">Limitar operações por custo</p>
                    </div>
                    <Switch />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Limites</h3>
                  
                  <div className="space-y-2">
                    <Label>OPS Budget Mensal</Label>
                    <Input type="number" defaultValue={1000000} />
                    <p className="text-xs text-muted-foreground">Operações R2 máximas por mês</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Max Retries</Label>
                    <Input type="number" defaultValue={3} />
                    <p className="text-xs text-muted-foreground">Tentativas antes de marcar como falha</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium mb-4">Cache Headers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assets Versionados</Label>
                    <Input defaultValue="public, max-age=31536000, immutable" />
                  </div>
                  <div className="space-y-2">
                    <Label>Playlists</Label>
                    <Input defaultValue="public, max-age=60, stale-while-revalidate=300" />
                  </div>
                </div>
              </div>

              <Button className="w-full">Salvar Configurações</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}