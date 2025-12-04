import { useEffect, useState } from 'react';
import { 
  RefreshCw, Plus, Trash2, Play, Search, 
  Clock, CheckCircle, XCircle, AlertTriangle, FileText,
  Copy, Loader2, Pencil, Cloud, ExternalLink, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useM3USync, M3USyncSource, M3USyncJob, SyncProgress } from '@/hooks/useM3USync';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { M3UCleanerDialog } from '@/components/admin/m3u/M3UCleanerDialog';
import { CleanSyncEntriesDialog } from '@/components/admin/m3u/CleanSyncEntriesDialog';
import { CleanM3UResult } from '@/hooks/useCleanM3U';

export default function AdminM3USyncContent() {
  const {
    sources,
    stats,
    isLoading,
    isSyncing,
    syncProgress,
    fetchSources,
    fetchStats,
    fetchSourceJobs,
    createSource,
    updateSource,
    deleteSource,
    triggerSync,
    cancelSync,
    searchEntries,
    getPlaylistUrl,
  } = useM3USync();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showJobsDialog, setShowJobsDialog] = useState(false);
  const [selectedSource, setSelectedSource] = useState<M3USyncSource | null>(null);
  const [jobs, setJobs] = useState<M3USyncJob[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [newSource, setNewSource] = useState({
    key: '',
    name: '',
    source_url: '',
    sync_interval_minutes: 30,
  });

  const [editSource, setEditSource] = useState({
    id: '',
    name: '',
    source_url: '',
    sync_interval_minutes: 30,
  });

  // M3U Cleaner integration
  const [showCleanerDialog, setShowCleanerDialog] = useState(false);
  const [cleanBeforeSync, setCleanBeforeSync] = useState(false);
  const [cleanedSourceUrl, setCleanedSourceUrl] = useState<string | null>(null);
  
  // Clean sync entries dialog
  const [showCleanSyncDialog, setShowCleanSyncDialog] = useState(false);
  const [cleanSyncSource, setCleanSyncSource] = useState<M3USyncSource | null>(null);

  const handleOpenCleanSync = (source: M3USyncSource) => {
    setCleanSyncSource(source);
    setShowCleanSyncDialog(true);
  };

  useEffect(() => {
    fetchSources();
    fetchStats();
  }, [fetchSources, fetchStats]);

  // Extrair playlists CDN dos sources (metadata contém cdn_url)
  const cdnPlaylists = sources
    .filter(s => s.metadata?.cdn_url)
    .map(s => ({
      id: s.id,
      key: s.key,
      name: s.name,
      cdn_url: s.metadata?.cdn_url as string,
      cdn_entries_count: s.metadata?.cdn_entries_count as number || 0,
      cdn_file_size: s.metadata?.cdn_file_size as number || 0,
      cdn_generated_at: s.metadata?.cdn_generated_at as string || null,
      enabled: s.enabled,
    }));

  const handleCreateSource = async () => {
    if (!newSource.key || !newSource.name || !newSource.source_url) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Use cleaned URL if available
    const finalUrl = cleanedSourceUrl || newSource.source_url;
    const result = await createSource({ ...newSource, source_url: finalUrl });
    if (result) {
      setShowCreateDialog(false);
      setNewSource({ key: '', name: '', source_url: '', sync_interval_minutes: 30 });
      setCleanedSourceUrl(null);
      setCleanBeforeSync(false);
    }
  };

  const handleCleanComplete = (result: CleanM3UResult) => {
    if (result.storageUrl) {
      setCleanedSourceUrl(result.storageUrl);
      setNewSource(prev => ({ ...prev, source_url: result.storageUrl! }));
      toast({
        title: 'URL limpa aplicada',
        description: `${result.stats.cleanedChannels} canais válidos salvos no CDN`,
      });
    }
    setShowCleanerDialog(false);
  };

  const handleViewJobs = async (source: M3USyncSource) => {
    setSelectedSource(source);
    const sourceJobs = await fetchSourceJobs(source.id);
    setJobs(sourceJobs);
    setShowJobsDialog(true);
  };

  const handleEditSource = (source: M3USyncSource) => {
    setEditSource({
      id: source.id,
      name: source.name,
      source_url: source.source_url,
      sync_interval_minutes: source.sync_interval_minutes,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editSource.name || !editSource.source_url) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const result = await updateSource(editSource.id, {
      name: editSource.name,
      source_url: editSource.source_url,
      sync_interval_minutes: editSource.sync_interval_minutes,
    });
    
    if (result) {
      setShowEditDialog(false);
      toast({
        title: 'Sucesso',
        description: 'Fonte atualizada com sucesso',
      });
    }
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
    <div className="space-y-6">
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
          <Button onClick={() => fetchSources()} disabled={isLoading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
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
              <Button size="sm">
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
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="https://exemplo.com/playlist.m3u"
                      value={newSource.source_url}
                      onChange={(e) => {
                        setNewSource({ ...newSource, source_url: e.target.value });
                        setCleanedSourceUrl(null);
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowCleanerDialog(true)}
                      disabled={!newSource.source_url.trim()}
                      title="Limpar playlist antes de criar"
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                  {cleanedSourceUrl && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>URL limpa aplicada</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cleanBeforeSync"
                    checked={cleanBeforeSync}
                    onCheckedChange={(v) => setCleanBeforeSync(v === true)}
                  />
                  <Label htmlFor="cleanBeforeSync" className="text-sm cursor-pointer">
                    Limpar playlist antes de sincronizar (remove duplicatas e URLs inválidas)
                  </Label>
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

          {/* M3U Cleaner Dialog */}
          <M3UCleanerDialog
            open={showCleanerDialog}
            onOpenChange={setShowCleanerDialog}
            initialUrl={newSource.source_url}
            onCleanComplete={handleCleanComplete}
          />
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
          <Button variant="outline" size="icon" onClick={handleSearch} disabled={isSearching}>
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
              {sources.map((source) => {
                const progress = syncProgress[source.key];
                return (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{source.name}</span>
                      {progress && progress.status === 'running' && (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Parte {progress.currentChunk}/{progress.totalChunks}</span>
                          </div>
                          <Progress 
                            value={(progress.entriesProcessed / Math.max(progress.totalEntries, 1)) * 100} 
                            className="h-1.5 w-24"
                          />
                          <span className="text-xs text-muted-foreground">
                            {progress.entriesProcessed.toLocaleString()} / {progress.totalEntries.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
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
                        title="Sincronizar"
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
                        onClick={() => handleOpenCleanSync(source)}
                        disabled={source.entries_count === 0}
                        title="Limpar entradas"
                        className="text-yellow-600 hover:text-yellow-700"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewJobs(source)}
                        title="Ver histórico"
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
                        onClick={() => handleEditSource(source)}
                        title="Editar fonte"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSource(source.id)}
                        className="text-destructive hover:text-destructive"
                      >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )})}
              {sources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma fonte configurada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Playlists CDN (Sincronização) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500" />
            Playlists CDN
          </CardTitle>
          <CardDescription>
            Playlists M3U geradas e hospedadas no CDN R2
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cdnPlaylists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma playlist CDN gerada</p>
              <p className="text-sm">Sincronize uma fonte para gerar a playlist CDN</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entradas CDN</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Última Geração</TableHead>
                  <TableHead className="text-right">URL CDN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cdnPlaylists.map((playlist) => (
                  <TableRow key={playlist.id}>
                    <TableCell className="font-medium">{playlist.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{playlist.key}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={playlist.enabled ? 'default' : 'secondary'}>
                        {playlist.enabled ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>{playlist.cdn_entries_count.toLocaleString()}</TableCell>
                    <TableCell>{formatBytes(playlist.cdn_file_size)}</TableCell>
                    <TableCell>
                      {playlist.cdn_generated_at ? (
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(playlist.cdn_generated_at), { locale: ptBR, addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyUrl(playlist.cdn_url)}
                          title="Copiar URL"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(playlist.cdn_url, '_blank')}
                          title="Abrir URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      {/* Jobs Dialog */}
      <Dialog open={showJobsDialog} onOpenChange={setShowJobsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de Sincronização</DialogTitle>
            <DialogDescription>
              {selectedSource?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entradas</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Tamanho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      {format(new Date(job.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        {getStatusBadge(job.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{job.entries_count?.toLocaleString() || 0}</span>
                        {(job as any).new_entries > 0 && (
                          <span className="text-xs text-green-500">+{(job as any).new_entries} novas</span>
                        )}
                        {(job as any).updated_entries > 0 && (
                          <span className="text-xs text-yellow-500">{(job as any).updated_entries} atualizadas</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell>
                      {(job as any).file_size_bytes ? formatBytes((job as any).file_size_bytes) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {jobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum histórico de sincronização
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Source Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fonte M3U</DialogTitle>
            <DialogDescription>
              Atualize os dados da fonte de playlist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Minha Playlist Principal"
                value={editSource.name}
                onChange={(e) => setEditSource({ ...editSource, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL da Fonte</Label>
              <Textarea
                placeholder="https://exemplo.com/playlist.m3u"
                value={editSource.source_url}
                onChange={(e) => setEditSource({ ...editSource, source_url: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Intervalo de Sincronização</Label>
              <Select
                value={editSource.sync_interval_minutes.toString()}
                onValueChange={(v) => setEditSource({ ...editSource, sync_interval_minutes: parseInt(v) })}
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clean Sync Entries Dialog */}
      {cleanSyncSource && (
        <CleanSyncEntriesDialog
          open={showCleanSyncDialog}
          onOpenChange={setShowCleanSyncDialog}
          sourceId={cleanSyncSource.id}
          sourceName={cleanSyncSource.name}
          entriesCount={cleanSyncSource.entries_count}
          onCleanComplete={() => {
            fetchSources();
            fetchStats();
          }}
        />
      )}
    </div>
  );
}