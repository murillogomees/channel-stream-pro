import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, Plus, Trash2, Play, Pause, ExternalLink, Search, 
  Download, Clock, CheckCircle, XCircle, AlertTriangle, FileText,
  Copy, Settings, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useM3USync, M3USyncSource, M3USyncJob } from '@/hooks/useM3USync';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminM3USync() {
  const navigate = useNavigate();
  const {
    sources,
    stats,
    isLoading,
    isSyncing,
    fetchSources,
    fetchStats,
    fetchSourceJobs,
    createSource,
    updateSource,
    deleteSource,
    triggerSync,
    searchEntries,
    getPlaylistUrl,
  } = useM3USync();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJobsDialog, setShowJobsDialog] = useState(false);
  const [selectedSource, setSelectedSource] = useState<M3USyncSource | null>(null);
  const [jobs, setJobs] = useState<M3USyncJob[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form state for new source
  const [newSource, setNewSource] = useState({
    key: '',
    name: '',
    source_url: '',
    sync_interval_minutes: 30,
  });

  useEffect(() => {
    fetchSources();
    fetchStats();
  }, [fetchSources, fetchStats]);

  const handleCreateSource = async () => {
    if (!newSource.key || !newSource.name || !newSource.source_url) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const result = await createSource(newSource);
    if (result) {
      setShowCreateDialog(false);
      setNewSource({ key: '', name: '', source_url: '', sync_interval_minutes: 30 });
    }
  };

  const handleViewJobs = async (source: M3USyncSource) => {
    setSelectedSource(source);
    const sourceJobs = await fetchSourceJobs(source.id);
    setJobs(sourceJobs);
    setShowJobsDialog(true);
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    
    setIsSearching(true);
    const results = await searchEntries(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copiada!' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary',
      partial: 'outline',
      pending: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status === 'completed' ? 'Sucesso' : 
         status === 'failed' ? 'Falhou' :
         status === 'running' ? 'Executando' :
         status === 'partial' ? 'Parcial' : 'Pendente'}
      </Badge>
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Sincronização M3U"
        description="Gerencie e sincronize playlists M3U de fontes externas"
        backTo="/dashboard"
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fontes</CardDescription>
              <CardTitle className="text-2xl">{stats?.total_sources || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ativas</CardDescription>
              <CardTitle className="text-2xl text-green-500">{stats?.active_sources || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Entradas</CardDescription>
              <CardTitle className="text-2xl">{(stats?.total_entries || 0).toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Última Sync</CardDescription>
              <CardTitle className="text-sm">
                {stats?.last_sync 
                  ? formatDistanceToNow(new Date(stats.last_sync), { locale: ptBR, addSuffix: true })
                  : 'Nunca'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sucesso (24h)</CardDescription>
              <CardTitle className="text-2xl text-green-500">{stats?.successful_syncs_24h || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Falhas (24h)</CardDescription>
              <CardTitle className="text-2xl text-red-500">{stats?.failed_syncs_24h || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Button onClick={() => fetchSources()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => triggerSync()} 
              disabled={isSyncing['all']}
            >
              {isSyncing['all'] ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Sincronizar Todas
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Fonte
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Fonte M3U</DialogTitle>
                  <DialogDescription>
                    Adicione uma nova URL de playlist M3U para sincronização
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Chave (identificador único)</Label>
                    <Input
                      placeholder="minha-playlist"
                      value={newSource.key}
                      onChange={(e) => setNewSource({ ...newSource, key: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') })}
                    />
                    <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números, hífens e underscores</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Minha Playlist Principal"
                      value={newSource.name}
                      onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL da Fonte</Label>
                    <Textarea
                      placeholder="https://exemplo.com/playlist.m3u"
                      value={newSource.source_url}
                      onChange={(e) => setNewSource({ ...newSource, source_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo de Sincronização</Label>
                    <Select
                      value={newSource.sync_interval_minutes.toString()}
                      onValueChange={(v) => setNewSource({ ...newSource, sync_interval_minutes: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="180">3 horas</SelectItem>
                        <SelectItem value="360">6 horas</SelectItem>
                        <SelectItem value="720">12 horas</SelectItem>
                        <SelectItem value="1440">24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateSource}>
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Buscar entradas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-[200px] md:w-[300px]"
            />
            <Button variant="outline" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Resultados da Busca ({searchResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.slice(0, 20).map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{entry.title}</TableCell>
                      <TableCell>{entry.group_title || '-'}</TableCell>
                      <TableCell>{entry.source_name}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyUrl(entry.stream_url)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Sources Table */}
        <Card>
          <CardHeader>
            <CardTitle>Fontes M3U</CardTitle>
            <CardDescription>
              Configure e monitore suas fontes de playlist M3U
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entradas</TableHead>
                  <TableHead>Última Sync</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{source.key}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(source.last_sync_status)}
                        {getStatusBadge(source.last_sync_status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{source.entries_count.toLocaleString()}</span>
                        {source.invalid_entries_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({source.invalid_entries_count} inválidas)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {source.last_sync_at ? (
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(source.last_sync_at), { locale: ptBR, addSuffix: true })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(source.file_size_bytes)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={source.enabled}
                        onCheckedChange={(checked) => updateSource(source.id, { enabled: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => triggerSync(source.key)}
                          disabled={isSyncing[source.key]}
                        >
                          {isSyncing[source.key] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewJobs(source)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyUrl(getPlaylistUrl(source.key))}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(getPlaylistUrl(source.key), '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSource(source.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sources.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma fonte configurada. Clique em "Nova Fonte" para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Jobs Dialog */}
        <Dialog open={showJobsDialog} onOpenChange={setShowJobsDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Histórico de Sincronização - {selectedSource?.name}</DialogTitle>
              <DialogDescription>
                Últimos 20 jobs de sincronização
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Entradas</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        {format(new Date(job.started_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : '-'}
                      </TableCell>
                      <TableCell>
                        {job.entries_count}
                        {job.invalid_entries_count > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({job.invalid_entries_count} inv.)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.triggered_by}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {job.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
