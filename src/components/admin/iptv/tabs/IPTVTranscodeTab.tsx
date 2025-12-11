/**
 * IPTV Transcode Tab - Video transcoding management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Zap, Play, Pause, RefreshCw, Loader2, CheckCircle, XCircle, 
  Clock, Search, Plus, Trash2, Settings
} from 'lucide-react';

interface TranscodeJob {
  id: number;
  channel_id: number;
  status: string;
  mode: string;
  progress: number;
  target_resolutions: string[];
  output_urls: Record<string, string> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function IPTVTranscodeTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch transcode jobs
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['transcode-jobs', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('iptv_transcode_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as TranscodeJob[];
    },
    refetchInterval: 5000, // Poll every 5s for active jobs
  });

  // Stats
  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  // Create transcode job
  const createMutation = useMutation({
    mutationFn: async (channelId: number) => {
      const { error } = await supabase.from('iptv_transcode_jobs').insert({
        channel_id: channelId,
        status: 'pending',
        mode: 'hls',
        target_resolutions: ['720p', '480p', '360p'],
        progress: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job de transcode criado');
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Cancel/Delete job
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

  // Retry failed job
  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('iptv_transcode_jobs')
        .update({ status: 'pending', error_message: null, progress: 0 })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job reagendado');
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
            O sistema de transcode converte streams de vídeo para múltiplas resoluções (720p, 480p, 360p) 
            com adaptive bitrate streaming (HLS). Jobs são processados em background por workers dedicados.
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
                placeholder="Buscar por channel ID..."
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
                <TableHead>Status</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Resoluções</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum job de transcode encontrado
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">#{job.id}</TableCell>
                    <TableCell className="font-mono text-xs">{job.channel_id}</TableCell>
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
