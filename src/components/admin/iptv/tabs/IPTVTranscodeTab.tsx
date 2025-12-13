/**
 * IPTV Transcode Tab - Video transcoding management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { iptvTranscodeService, TranscodeJob } from '@/services/iptvTranscodeService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Zap, RefreshCw, Loader2, CheckCircle, XCircle, 
  Clock, Search, Plus, Trash2, Settings, Play, StopCircle,
  Square, RotateCcw, Eraser
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const RESOLUTION_OPTIONS = ['1080p', '720p', '480p', '360p', '240p'];

export function IPTVTranscodeTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>(['720p', '480p', '360p']);
  const [transcodeMode, setTranscodeMode] = useState<'hls' | 'dash'>('hls');

  // Fetch transcode jobs via Edge Function
  const { data: jobsData, isLoading, refetch } = useQuery({
    queryKey: ['transcode-jobs', search, statusFilter],
    queryFn: async () => {
      const { jobs, stats } = await iptvTranscodeService.listTranscodeJobs();
      let filtered = jobs;
      
      if (statusFilter !== 'all') {
        filtered = jobs.filter(j => j.status === statusFilter);
      }
      if (search) {
        filtered = filtered.filter(j => 
          j.channel_id.toString().includes(search) || 
          j.id.toString().includes(search)
        );
      }
      
      return { jobs: filtered, stats };
    },
    refetchInterval: 5000,
  });

  const jobs = jobsData?.jobs || [];
  const stats = jobsData?.stats || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };

  // Fetch channels for dropdown
  const { data: channels = [] } = useQuery({
    queryKey: ['iptv-channels-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('id, name')
        .order('name')
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Create transcode job
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChannel) throw new Error('Selecione um canal');
      return iptvTranscodeService.createTranscodeJob(selectedChannel, {
        mode: transcodeMode,
        resolutions: selectedResolutions,
      });
    },
    onSuccess: () => {
      toast.success('Job de transcode criado');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
      setIsCreateOpen(false);
      setSelectedChannel(null);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Cancel job
  const cancelMutation = useMutation({
    mutationFn: (id: number) => iptvTranscodeService.cancelTranscodeJob(id),
    onSuccess: () => {
      toast.success('Job cancelado');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Retry failed job
  const retryMutation = useMutation({
    mutationFn: (id: number) => iptvTranscodeService.retryTranscodeJob(id),
    onSuccess: () => {
      toast.success('Job reagendado');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Delete job
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('iptv_transcode_jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job removido');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Stop all processing jobs
  const stopAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('iptv_transcode_jobs')
        .update({ status: 'cancelled' })
        .in('status', ['pending', 'processing']);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Todos os jobs foram parados');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Restart failed jobs
  const restartAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('iptv_transcode_jobs')
        .update({ status: 'pending', progress: 0, error_message: null })
        .in('status', ['failed', 'cancelled']);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Jobs reiniciados');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Clear all jobs
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('iptv_transcode_jobs').delete().neq('id', 0);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Todos os jobs foram removidos');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'processing': return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case 'completed': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'failed': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'cancelled': return <Badge variant="secondary"><StopCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <Zap className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-yellow-500">{stats.pending}</p>
              </div>
              <Clock className="h-6 w-6 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Processando</p>
                <p className="text-xl font-bold text-blue-500">{stats.processing}</p>
              </div>
              <Loader2 className="h-6 w-6 text-blue-500 opacity-50 animate-spin" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="text-xl font-bold text-green-500">{stats.completed}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Falharam</p>
                <p className="text-xl font-bold text-red-500">{stats.failed}</p>
              </div>
              <XCircle className="h-6 w-6 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sistema de Transcode
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            O sistema de transcode converte streams de vídeo para múltiplas resoluções (1080p, 720p, 480p, 360p) 
            com adaptive bitrate streaming (HLS/DASH). Jobs são processados em background por workers dedicados.
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por channel ID ou job ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Bulk Actions */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-yellow-600 border-yellow-600/50 hover:bg-yellow-600/10">
                  <Square className="h-4 w-4 mr-1" />
                  Parar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Parar todos os jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá cancelar todos os jobs pendentes e em processamento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => stopAllMutation.mutate()}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    {stopAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Parar Todos
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-blue-600 border-blue-600/50 hover:bg-blue-600/10">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reiniciar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reiniciar jobs falhados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá reagendar todos os jobs que falharam ou foram cancelados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => restartAllMutation.mutate()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {restartAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Reiniciar Jobs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                  <Eraser className="h-4 w-4 mr-1" />
                  Limpar Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá remover permanentemente todos os jobs da fila. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => clearAllMutation.mutate()}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {clearAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Limpar Todos
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Job
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Job de Transcode</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Canal</Label>
                    <Select 
                      value={selectedChannel?.toString() || ''} 
                      onValueChange={(v) => setSelectedChannel(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id.toString()}>
                            {ch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Modo</Label>
                    <Select value={transcodeMode} onValueChange={(v) => setTranscodeMode(v as 'hls' | 'dash')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hls">HLS (HTTP Live Streaming)</SelectItem>
                        <SelectItem value="dash">DASH (Dynamic Adaptive Streaming)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Resoluções</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {RESOLUTION_OPTIONS.map((res) => (
                        <div key={res} className="flex items-center space-x-2">
                          <Checkbox
                            id={res}
                            checked={selectedResolutions.includes(res)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedResolutions([...selectedResolutions, res]);
                              } else {
                                setSelectedResolutions(selectedResolutions.filter(r => r !== res));
                              }
                            }}
                          />
                          <Label htmlFor={res} className="text-sm">{res}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !selectedChannel || selectedResolutions.length === 0}
                  >
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Iniciar Transcode
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Resoluções</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum job de transcode encontrado
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                    <TableCell className="font-mono text-xs">{job.channel_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">{job.mode || 'hls'}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      <div className="w-24">
                        <Progress value={job.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">{job.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {job.target_resolutions?.map(res => (
                          <Badge key={res} variant="outline" className="text-xs">{res}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(job.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {job.status === 'processing' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => cancelMutation.mutate(job.id)} title="Cancelar">
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {job.status === 'failed' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" 
                            onClick={() => retryMutation.mutate(job.id)} title="Retry">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(job.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
