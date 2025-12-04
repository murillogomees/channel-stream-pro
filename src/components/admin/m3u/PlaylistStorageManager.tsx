import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, Download, Trash2, RefreshCw, ExternalLink, 
  Archive, HardDrive, Clock, FileText, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

export function PlaylistStorageManager() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('playlists', {
        method: 'GET',
      });
      
      if (error) throw error;
      setPlaylists(data?.data || []);
    } catch (err) {
      toast.error('Erro ao carregar playlists');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadArchives = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('*')
        .order('month', { ascending: false });
      
      if (error) throw error;
      setArchives(data || []);
    } catch (err) {
      toast.error('Erro ao carregar archives');
      console.error(err);
    } finally {
      setLoading(false);
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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
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
              Playlists
            </TabsTrigger>
            <TabsTrigger value="archives" className="gap-1">
              <Archive className="w-4 h-4" />
              Archives
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={loadPlaylists} disabled={loading} variant="outline" size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Carregar
              </Button>
            </div>

            {playlists.length > 0 && (
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
              <Button onClick={loadArchives} disabled={loading} variant="outline" size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Carregar
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
                Nenhum archive encontrado. Clique em "Carregar" para buscar.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
