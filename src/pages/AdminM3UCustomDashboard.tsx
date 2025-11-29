import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { List, Tv, Cloud, Activity, CheckCircle, XCircle, Clock, Pencil, Plus, Eye, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface CdnPlaylist {
  id: string;
  key: string;
  name: string;
  cdn_url: string;
  cdn_entries_count: number;
  cdn_file_size: number;
  cdn_generated_at: string | null;
  enabled: boolean;
  entries_count: number;
}

export default function AdminM3UCustomDashboard() {
  const navigate = useNavigate();
  const [cdnPlaylists, setCdnPlaylists] = useState<CdnPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCdnPlaylists();
  }, []);

  const loadCdnPlaylists = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('m3u_sync_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar sources que têm CDN URL no metadata
      const playlistsWithCdn = (data || [])
        .filter((s: any) => s.metadata?.cdn_url)
        .map((s: any) => ({
          id: s.id,
          key: s.key,
          name: s.name,
          cdn_url: s.metadata?.cdn_url as string,
          cdn_entries_count: s.metadata?.cdn_entries_count as number || 0,
          cdn_file_size: s.metadata?.cdn_file_size as number || 0,
          cdn_generated_at: s.metadata?.cdn_generated_at as string || null,
          enabled: s.enabled,
          entries_count: s.entries_count || 0,
        }));

      setCdnPlaylists(playlistsWithCdn);
    } catch (error) {
      console.error('Erro ao carregar playlists CDN:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copiada!' });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalLists = cdnPlaylists.length;
  const activeLists = cdnPlaylists.filter(l => l.enabled).length;
  const totalChannels = cdnPlaylists.reduce((sum, l) => sum + l.cdn_entries_count, 0);
  const totalFileSize = cdnPlaylists.reduce((sum, l) => sum + l.cdn_file_size, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Dashboard M3U CDN</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Monitoramento das playlists CDN sincronizadas</p>
        </div>
        <Button onClick={() => loadCdnPlaylists()} size="sm" className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {/* Stats Grid - Responsivo 2x2 no mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Playlists CDN</CardTitle>
            <List className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalLists}</div>
            <p className="text-xs text-muted-foreground">{activeLists} ativa(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Entradas CDN</CardTitle>
            <Tv className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalChannels.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">canais sincronizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tamanho Total</CardTitle>
            <Cloud className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{formatBytes(totalFileSize)}</div>
            <p className="text-xs text-muted-foreground">hospedado no R2</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Status</CardTitle>
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-green-500">
              {activeLists > 0 ? 'Online' : 'Offline'}
            </div>
            <p className="text-xs text-muted-foreground">CDN R2 Cloudflare</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Playlists CDN - Desktop */}
      <Card className="hidden md:block">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Playlists CDN Ativas</CardTitle>
          <CardDescription className="text-xs">Playlists M3U geradas e hospedadas no CDN R2</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : cdnPlaylists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma playlist CDN gerada</p>
              <p className="text-sm">Sincronize uma fonte M3U para gerar a playlist CDN</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entradas CDN</TableHead>
                    <TableHead className="hidden lg:table-cell">Tamanho</TableHead>
                    <TableHead className="hidden lg:table-cell">Última Geração</TableHead>
                    <TableHead className="text-right">URL CDN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cdnPlaylists.map((playlist) => (
                    <TableRow key={playlist.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[150px]">{playlist.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{playlist.key}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={playlist.enabled ? 'default' : 'secondary'} className="text-xs">
                          {playlist.enabled ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>{playlist.cdn_entries_count.toLocaleString()}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatBytes(playlist.cdn_file_size)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {playlist.cdn_generated_at 
                          ? formatDistanceToNow(new Date(playlist.cdn_generated_at), { locale: ptBR, addSuffix: true })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={() => handleCopyUrl(playlist.cdn_url)}
                            title="Copiar URL"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={() => window.open(playlist.cdn_url, '_blank')}
                            title="Abrir URL"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Playlists CDN - Mobile */}
      <div className="md:hidden space-y-3">
        <h3 className="text-sm font-medium">Playlists CDN Ativas</h3>
        {isLoading ? (
          <Card><CardContent className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></CardContent></Card>
        ) : cdnPlaylists.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground text-center">Nenhuma playlist CDN gerada</CardContent></Card>
        ) : (
          cdnPlaylists.map((playlist) => (
            <Card key={playlist.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{playlist.name}</p>
                    <code className="text-xs text-muted-foreground">{playlist.key}</code>
                  </div>
                  <Badge variant={playlist.enabled ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                    {playlist.enabled ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{playlist.cdn_entries_count.toLocaleString()} entradas</span>
                  <span>{formatBytes(playlist.cdn_file_size)}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  {playlist.cdn_generated_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(playlist.cdn_generated_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyUrl(playlist.cdn_url)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(playlist.cdn_url, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Informações sobre Otimização R2 */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Cloud className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            Otimizações R2 Ativas
          </CardTitle>
          <CardDescription className="text-xs">Tecnologias avançadas</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">CDN Global</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Latência mínima global</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Cache Agressivo</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Performance máxima</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Zero Egress</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">90% economia vs S3</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">VOD Hosting</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Hospedagem independente</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Stream Proxy</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Autenticação tempo real</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Auto Regeneração</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">M3U diário ao CDN</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
