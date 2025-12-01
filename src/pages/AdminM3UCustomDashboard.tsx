import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  List, Tv, Cloud, Activity, CheckCircle, Film, Clapperboard, 
  Layers, HardDrive, Play, Copy, ExternalLink, Loader2, 
  RefreshCw, Database, FolderTree, TrendingUp, Zap
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface ContentStats {
  tv: number;
  movies: number;
  series: number;
  other: number;
  total: number;
  categories: {
    tv: number;
    movies: number;
    series: number;
    other: number;
    total: number;
  };
}

export default function AdminM3UCustomDashboard() {
  const [cdnPlaylists, setCdnPlaylists] = useState<CdnPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contentStats, setContentStats] = useState<ContentStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    loadCdnPlaylists();
    loadContentStats();
  }, []);

  const loadCdnPlaylists = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('m3u_sync_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  const loadContentStats = async () => {
    try {
      setIsLoadingStats(true);
      
      // Buscar estatísticas de conteúdo por tipo
      const { data: entries, error } = await supabase
        .from('m3u_sync_entries')
        .select('group_title')
        .eq('is_valid', true);

      if (error) throw error;

      // Classificar conteúdo
      const stats: ContentStats = {
        tv: 0,
        movies: 0,
        series: 0,
        other: 0,
        total: 0,
        categories: { tv: 0, movies: 0, series: 0, other: 0, total: 0 }
      };

      const categoriesSeen = {
        tv: new Set<string>(),
        movies: new Set<string>(),
        series: new Set<string>(),
        other: new Set<string>(),
      };

      (entries || []).forEach((entry: any) => {
        const groupTitle = (entry.group_title || '').toLowerCase();
        const category = entry.group_title || 'Sem Categoria';
        
        if (
          groupTitle.includes('séries') ||
          groupTitle.includes('series') ||
          groupTitle.includes('temporada') ||
          groupTitle.includes('novelas') ||
          groupTitle.includes('doramas') ||
          groupTitle.includes('animes') ||
          groupTitle.includes('reality') ||
          groupTitle.includes('tokusatsu')
        ) {
          stats.series++;
          categoriesSeen.series.add(category);
        } else if (
          groupTitle.includes('filme') ||
          groupTitle.includes('filmes') ||
          groupTitle.includes('movie') ||
          groupTitle.includes('cinema') ||
          groupTitle.includes('lançamento')
        ) {
          stats.movies++;
          categoriesSeen.movies.add(category);
        } else if (
          groupTitle.includes('canais') ||
          groupTitle.includes('tv') ||
          groupTitle.includes('ao vivo') ||
          groupTitle.includes('live') ||
          groupTitle.includes('24h') ||
          groupTitle.includes('globo') ||
          groupTitle.includes('pluto')
        ) {
          stats.tv++;
          categoriesSeen.tv.add(category);
        } else {
          stats.other++;
          categoriesSeen.other.add(category);
        }
        stats.total++;
      });

      stats.categories = {
        tv: categoriesSeen.tv.size,
        movies: categoriesSeen.movies.size,
        series: categoriesSeen.series.size,
        other: categoriesSeen.other.size,
        total: categoriesSeen.tv.size + categoriesSeen.movies.size + categoriesSeen.series.size + categoriesSeen.other.size,
      };

      setContentStats(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copiada!' });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalLists = cdnPlaylists.length;
  const activeLists = cdnPlaylists.filter(l => l.enabled).length;
  const totalChannels = cdnPlaylists.reduce((sum, l) => sum + l.cdn_entries_count, 0);
  const totalFileSize = cdnPlaylists.reduce((sum, l) => sum + l.cdn_file_size, 0);

  // Calcular VODs que precisam ser processados
  const vodStats = useMemo(() => {
    if (!contentStats) return null;
    return {
      totalVODs: contentStats.movies + contentStats.series,
      liveTV: contentStats.tv,
      other: contentStats.other,
    };
  }, [contentStats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Dashboard M3U CDN
          </h2>
          <p className="text-sm text-muted-foreground">Monitoramento completo das playlists e VODs hospedados no R2</p>
        </div>
        <Button onClick={() => { loadCdnPlaylists(); loadContentStats(); }} size="sm" variant="outline">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {/* Stats Grid Principal */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Playlists CDN</CardTitle>
            <List className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLists}</div>
            <p className="text-xs text-muted-foreground">{activeLists} ativa(s) hospedadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas CDN</CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentStats?.total.toLocaleString() || '...'}</div>
            <p className="text-xs text-muted-foreground">total de conteúdos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias VOD</CardTitle>
            <FolderTree className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentStats?.categories.total || '...'}</div>
            <p className="text-xs text-muted-foreground">categorias organizadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamanho Total</CardTitle>
            <HardDrive className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalFileSize)}</div>
            <p className="text-xs text-muted-foreground">hospedado no R2</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown por Tipo de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card de Tipos de Conteúdo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Distribuição de Conteúdo
            </CardTitle>
            <CardDescription className="text-xs">Entradas por tipo de conteúdo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStats ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contentStats && (
              <>
                {/* Séries */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clapperboard className="h-4 w-4 text-green-500" />
                      <span>Séries</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600 border-green-600/30">
                        {contentStats.categories.series} categorias
                      </Badge>
                      <span className="font-semibold">{contentStats.series.toLocaleString()}</span>
                    </div>
                  </div>
                  <Progress value={(contentStats.series / contentStats.total) * 100} className="h-2" />
                </div>

                {/* Filmes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-purple-500" />
                      <span>Filmes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-purple-600 border-purple-600/30">
                        {contentStats.categories.movies} categorias
                      </Badge>
                      <span className="font-semibold">{contentStats.movies.toLocaleString()}</span>
                    </div>
                  </div>
                  <Progress value={(contentStats.movies / contentStats.total) * 100} className="h-2" />
                </div>

                {/* TV ao Vivo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4 text-blue-500" />
                      <span>TV ao Vivo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-600 border-blue-600/30">
                        {contentStats.categories.tv} categorias
                      </Badge>
                      <span className="font-semibold">{contentStats.tv.toLocaleString()}</span>
                    </div>
                  </div>
                  <Progress value={(contentStats.tv / contentStats.total) * 100} className="h-2" />
                </div>

                {/* Outros */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-gray-500" />
                      <span>Outros</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-gray-600 border-gray-600/30">
                        {contentStats.categories.other} categorias
                      </Badge>
                      <span className="font-semibold">{contentStats.other.toLocaleString()}</span>
                    </div>
                  </div>
                  <Progress value={(contentStats.other / contentStats.total) * 100} className="h-2" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card de VODs para Processamento */}
        <Card className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              VODs para Storage
            </CardTitle>
            <CardDescription className="text-xs">Conteúdos a serem processados para R2/Stream</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vodStats && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/50 rounded-lg p-3 border">
                    <div className="flex items-center gap-2 mb-1">
                      <HardDrive className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">Para R2 CDN</span>
                    </div>
                    <p className="text-xl font-bold text-green-600">{vodStats.totalVODs.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Filmes + Séries</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 border">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-muted-foreground">Para Stream</span>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{vodStats.liveTV.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">TV ao Vivo</p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                  <p className="font-medium">Política de Roteamento:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span><strong>VOD (Filmes/Séries):</strong> Cloudflare R2</span>
                    </li>
                    <li className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-blue-500" />
                      <span><strong>Live TV:</strong> Cloudflare Stream ou Origin</span>
                    </li>
                    <li className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-orange-500" />
                      <span><strong>Reality/Eventos:</strong> Hybrid (R2 + Stream)</span>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de Playlists CDN */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Playlists CDN Hospedadas
          </CardTitle>
          <CardDescription className="text-xs">Listas M3U geradas e hospedadas no Cloudflare R2</CardDescription>
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
              <p className="text-sm">Use o Editor M3U para gerar e hospedar playlists no CDN</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="hidden lg:table-cell">Última Geração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                        <Badge variant={playlist.enabled ? 'default' : 'secondary'} className="text-xs">
                          {playlist.enabled ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{playlist.cdn_entries_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatBytes(playlist.cdn_file_size)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {playlist.cdn_generated_at 
                          ? formatDistanceToNow(new Date(playlist.cdn_generated_at), { locale: ptBR, addSuffix: true })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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

      {/* Tecnologias e Otimizações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cloud className="h-4 w-4 text-blue-500" />
              Cloudflare R2 CDN
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Zero Egress - 90% economia vs S3</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>CDN Global - Latência mínima</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>VOD Hosting - Filmes e Séries</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-orange-500" />
              Cloudflare Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>100 uploads paralelos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Retry automático (5x)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Live TV e conteúdo dinâmico</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
