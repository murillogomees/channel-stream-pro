import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, Download, Trash2, RefreshCw, ExternalLink, 
  Archive, HardDrive, Clock, FileText, Loader2, Settings,
  Calendar, Timer, FolderArchive
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Playlist {
  id: string;
  filename: string;
  storage_path: string;
  channel_count: number;
  sha256: string;
  size_bytes: number;
  created_at: string;
  expires_at: string;
  archived: boolean;
}

interface ArchiveRecord {
  id: string;
  path: string;
  month: string;
  size_bytes: number;
  sha256: string;
  playlist_count: number;
  created_at: string;
}

// Configurações do sistema de storage
const STORAGE_CONFIG = {
  RETENTION_DAYS: 30,
  ARCHIVE_DAY: 3, // Dia do mês que o cron executa
  SIGNED_URL_EXPIRES: 3600, // 1 hora em segundos
  BUCKET_NAME: 'playlists',
  R2_BUCKET: 'iptvlink-cdn',
};

export function PlaylistStorageManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Auto-load dados ao montar o componente
  useEffect(() => {
    if (!initialLoaded) {
      loadAllData();
      setInitialLoaded(true);
    }
  }, [initialLoaded]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPlaylists(), loadArchives()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylists = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('playlists', {
        method: 'GET',
      });
      
      if (error) throw error;
      setPlaylists(data?.data || []);
    } catch (err) {
      console.error('Erro ao carregar playlists:', err);
    }
  };

  const loadArchives = async () => {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('*')
        .order('month', { ascending: false });
      
      if (error) throw error;
      setArchives(data || []);
    } catch (err) {
      console.error('Erro ao carregar archives:', err);
    }
  };

  const getSignedUrl = async (playlistId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`playlists/${playlistId}`, {
        method: 'GET',
      });
      
      if (error) throw error;
      setSignedUrl(data?.signedUrl || null);
      setSelectedPlaylist(playlistId);
      toast.success('Signed URL gerada');
    } catch (err) {
      toast.error('Erro ao gerar signed URL');
      console.error(err);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta playlist?')) return;
    
    try {
      const { error } = await supabase.functions.invoke(`playlists/${playlistId}`, {
        method: 'DELETE',
      });
      
      if (error) throw error;
      toast.success('Playlist deletada');
      loadPlaylists();
    } catch (err) {
      toast.error('Erro ao deletar playlist');
      console.error(err);
    }
  };

  const runArchiveJob = async () => {
    if (!confirm('Executar job de arquivamento? Isso compactará playlists do mês anterior.')) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('archive-playlists?force=true');
      
      if (error) throw error;
      
      if (data?.skipped) {
        toast.info(data.message);
      } else {
        toast.success(`Arquivamento concluído: ${data?.stats?.playlistCount || 0} playlists`);
      }
      
      loadArchives();
    } catch (err) {
      toast.error('Erro ao executar arquivamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  // Calcular estatísticas
  const stats = {
    totalPlaylists: playlists.length,
    activePlaylists: playlists.filter(p => !p.archived).length,
    archivedPlaylists: playlists.filter(p => p.archived).length,
    totalArchives: archives.length,
    totalStorageBytes: playlists.reduce((sum, p) => sum + (p.size_bytes || 0), 0),
    archiveStorageBytes: archives.reduce((sum, a) => sum + (a.size_bytes || 0), 0),
    totalChannels: playlists.reduce((sum, p) => sum + (p.channel_count || 0), 0),
  };

  // Calcular próxima execução do cron (dia 3 do próximo mês)
  const getNextArchiveDate = () => {
    const now = new Date();
    let nextDate = setDate(now, STORAGE_CONFIG.ARCHIVE_DAY);
    if (nextDate <= now) {
      nextDate = setDate(addMonths(now, 1), STORAGE_CONFIG.ARCHIVE_DAY);
    }
    return format(nextDate, "dd/MM/yyyy", { locale: ptBR });
  };

  // Último arquivamento
  const lastArchive = archives[0];

  return (
    <div className="space-y-4">
      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Playlists Ativas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.activePlaylists}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Storage Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatBytes(stats.totalStorageBytes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Archives</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalArchives}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(stats.archiveStorageBytes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Total Canais</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalChannels.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações e Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações de Retenção & Arquivamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Timer className="w-3 h-3" /> Retenção
              </span>
              <p className="font-medium">{STORAGE_CONFIG.RETENTION_DAYS} dias</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Dia do Cron
              </span>
              <p className="font-medium">Dia {STORAGE_CONFIG.ARCHIVE_DAY}/mês</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Signed URL TTL
              </span>
              <p className="font-medium">{STORAGE_CONFIG.SIGNED_URL_EXPIRES / 60} min</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">R2 Bucket</span>
              <p className="font-medium font-mono text-xs">{STORAGE_CONFIG.R2_BUCKET}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Próximo Archive</span>
              <p className="font-medium">{getNextArchiveDate()}</p>
            </div>
          </div>
          {lastArchive && (
            <div className="mt-4 pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                Último arquivamento: <strong>{lastArchive.month}</strong> em {formatDate(lastArchive.created_at)} 
                ({lastArchive.playlist_count} playlists, {formatBytes(lastArchive.size_bytes)})
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gerenciador Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Gerenciador de Playlists Storage
          </CardTitle>
          <CardDescription>
            Gerencie playlists persistidas e arquivos compactados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="playlists">
            <TabsList className="mb-4">
              <TabsTrigger value="playlists" className="gap-1">
                <FileText className="w-4 h-4" />
                Playlists ({stats.activePlaylists})
              </TabsTrigger>
              <TabsTrigger value="archives" className="gap-1">
                <Archive className="w-4 h-4" />
                Archives ({stats.totalArchives})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="playlists" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={loadAllData} disabled={loading} variant="outline" size="sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Atualizar
                </Button>
              </div>

              {playlists.length > 0 ? (
                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-4 space-y-3">
                    {playlists.map((playlist) => (
                      <div
                        key={playlist.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{playlist.filename}</span>
                            {playlist.archived && (
                              <Badge variant="secondary">Arquivado</Badge>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatBytes(playlist.size_bytes)}
                            </span>
                            <span>{playlist.channel_count} canais</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(playlist.created_at)}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground truncate max-w-[300px]">
                            SHA256: {playlist.sha256?.substring(0, 16)}...
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => getSignedUrl(playlist.id)}
                            title="Gerar Signed URL"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deletePlaylist(playlist.id)}
                            title="Deletar"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {loading ? 'Carregando...' : 'Nenhuma playlist encontrada'}
                </div>
              )}

              {selectedPlaylist && signedUrl && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="text-sm font-medium">Signed URL (expira em 1h):</div>
                  <Input value={signedUrl} readOnly className="font-mono text-xs" />
                  <Button size="sm" variant="outline" asChild>
                    <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="archives" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={loadAllData} disabled={loading} variant="outline" size="sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Atualizar
                </Button>
                <Button onClick={runArchiveJob} disabled={loading} variant="secondary" size="sm">
                  <Archive className="w-4 h-4 mr-1" />
                  Executar Arquivamento
                </Button>
              </div>

              {archives.length > 0 ? (
                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-4 space-y-3">
                    {archives.map((archive) => (
                      <div
                        key={archive.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{archive.month}</div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatBytes(archive.size_bytes)}
                            </span>
                            <span>{archive.playlist_count} playlists</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(archive.created_at)}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {archive.path}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {loading ? 'Carregando...' : 'Nenhum archive encontrado'}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
