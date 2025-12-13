/**
 * IPTV Series Tab - Hierarchical series management
 * Structure: Category > Series Name > Season > Episode
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  Search, RefreshCw, Trash2, Edit, Loader2, 
  ChevronDown, ChevronRight, FolderOpen, Folder, 
  MoreVertical, Pencil, Film, Tv2, Play, 
  Clapperboard, Hash, Calendar, ArrowRightLeft,
  Wand2, Check, X, ListTree, LayoutList
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeriesChannel {
  id: number;
  name: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  series_name: string | null;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  is_series: boolean;
  is_healthy: boolean;
  created_at: string;
}

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  episode_title: string | null;
  original_url: string;
  logo_url: string | null;
  is_healthy: boolean;
}

interface Season {
  number: number;
  episodes: Episode[];
}

interface Series {
  name: string;
  logo_url: string | null;
  seasons: Season[];
  totalEpisodes: number;
}

interface CategoryGroup {
  name: string;
  series: Series[];
  totalSeries: number;
  totalEpisodes: number;
}

type ViewMode = 'hierarchy' | 'flat';

export function IPTVSeriesTab() {
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');
  const [search, setSearch] = useState('');
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isAutoOrganizeOpen, setIsAutoOrganizeOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameSeriesOpen, setIsRenameSeriesOpen] = useState(false);
  const [renamingSeriesInfo, setRenamingSeriesInfo] = useState<{ category: string; oldName: string } | null>(null);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [targetSeriesName, setTargetSeriesName] = useState('');
  const [targetCategory, setTargetCategory] = useState('');

  // Fetch all series channels
  const { data: seriesChannels, isLoading, refetch } = useQuery({
    queryKey: ['iptv-series-channels', search],
    queryFn: async () => {
      let query = supabase
        .from('iptv_channels')
        .select('id, name, original_url, logo_url, category, series_name, season_number, episode_number, episode_title, is_series, is_healthy, created_at')
        .eq('is_series', true)
        .order('category', { ascending: true, nullsFirst: false })
        .order('series_name', { ascending: true })
        .order('season_number', { ascending: true })
        .order('episode_number', { ascending: true });

      if (search) {
        query = query.or(`name.ilike.%${search}%,series_name.ilike.%${search}%,category.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SeriesChannel[];
    },
  });

  // Fetch non-organized channels (potential series - only in eligible categories)
  const { data: unorganizedCount } = useQuery({
    queryKey: ['iptv-unorganized-count'],
    queryFn: async () => {
      // Get all channels that haven't been processed yet and are in eligible categories
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('id, category', { count: 'exact' })
        .or('is_series.is.null,is_series.eq.false')
        .is('series_name', null);
      
      if (error) throw error;
      if (!data) return 0;
      
      // Exclude categories that are not eligible for series detection
      const excludedPatterns = [
        'filme', 'filmes', 'movie', 'movies', 'film', 'cinema', 'lançamento', 'lancamento',
        'aberto', '24 h', '24h', 'canais', 'canal', 'tv ', ' tv', 'ao vivo', 'aovivo', 'live',
        'esporte', 'sport', 'futebol', 'football', 'news', 'noticia', 'jornalismo',
        'fhd', 'premiere', 'reality', 'pay per view', 'ppv', 'pay-per-view',
        'combate', 'ufc', 'luta', 'boxe',
        'adulto', 'adult', 'xxx', '18+', '+18'
      ];
      
      const eligibleChannels = data.filter(channel => {
        if (!channel.category) return true; // Null category is eligible
        const catLower = channel.category.toLowerCase();
        return !excludedPatterns.some(pattern => catLower.includes(pattern));
      });
      
      return eligibleChannels.length;
    },
  });

  // Build hierarchical structure
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    if (!seriesChannels) return [];
    
    const categoryMap = new Map<string, Map<string, Map<number, Episode[]>>>();
    const seriesLogos = new Map<string, string>();
    
    seriesChannels.forEach(channel => {
      const cat = channel.category || 'Sem Categoria';
      const seriesName = channel.series_name || 'Série Desconhecida';
      const seasonNum = channel.season_number || 1;
      
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, new Map());
      }
      const seriesMap = categoryMap.get(cat)!;
      
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, new Map());
      }
      const seasonMap = seriesMap.get(seriesName)!;
      
      if (!seasonMap.has(seasonNum)) {
        seasonMap.set(seasonNum, []);
      }
      
      // Store logo from first episode with logo
      if (channel.logo_url && !seriesLogos.has(`${cat}|${seriesName}`)) {
        seriesLogos.set(`${cat}|${seriesName}`, channel.logo_url);
      }
      
      seasonMap.get(seasonNum)!.push({
        id: channel.id,
        name: channel.name,
        episode_number: channel.episode_number || 0,
        episode_title: channel.episode_title,
        original_url: channel.original_url,
        logo_url: channel.logo_url,
        is_healthy: channel.is_healthy,
      });
    });
    
    // Convert to array structure
    return Array.from(categoryMap.entries()).map(([catName, seriesMap]) => {
      const series: Series[] = Array.from(seriesMap.entries()).map(([seriesName, seasonMap]) => {
        const seasons: Season[] = Array.from(seasonMap.entries())
          .map(([num, eps]) => ({
            number: num,
            episodes: eps.sort((a, b) => a.episode_number - b.episode_number),
          }))
          .sort((a, b) => a.number - b.number);
        
        return {
          name: seriesName,
          logo_url: seriesLogos.get(`${catName}|${seriesName}`) || null,
          seasons,
          totalEpisodes: seasons.reduce((sum, s) => sum + s.episodes.length, 0),
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      
      return {
        name: catName,
        series,
        totalSeries: series.length,
        totalEpisodes: series.reduce((sum, s) => sum + s.totalEpisodes, 0),
      };
    }).sort((a, b) => {
      if (a.name === 'Sem Categoria') return 1;
      if (b.name === 'Sem Categoria') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [seriesChannels]);

  // Stats
  const stats = useMemo(() => ({
    totalEpisodes: seriesChannels?.length || 0,
    totalSeries: categoryGroups.reduce((sum, cat) => sum + cat.totalSeries, 0),
    totalCategories: categoryGroups.length,
    unorganized: unorganizedCount || 0,
  }), [seriesChannels, categoryGroups, unorganizedCount]);

  // Get all unique series names for move dialog
  const allSeriesNames = useMemo(() => {
    const names = new Set<string>();
    categoryGroups.forEach(cat => cat.series.forEach(s => names.add(s.name)));
    return Array.from(names).sort();
  }, [categoryGroups]);

  // Get all categories
  const allCategories = useMemo(() => {
    return categoryGroups.map(c => c.name).filter(n => n !== 'Sem Categoria');
  }, [categoryGroups]);

  // Toggle helpers
  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const toggleSeries = useCallback((key: string) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleSeason = useCallback((key: string) => {
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const cats = new Set(categoryGroups.map(c => c.name));
    const series = new Set<string>();
    const seasons = new Set<string>();
    categoryGroups.forEach(cat => {
      cat.series.forEach(s => {
        const seriesKey = `${cat.name}|${s.name}`;
        series.add(seriesKey);
        s.seasons.forEach(season => {
          seasons.add(`${seriesKey}|${season.number}`);
        });
      });
    });
    setExpandedCategories(cats);
    setExpandedSeries(series);
    setExpandedSeasons(seasons);
  }, [categoryGroups]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
    setExpandedSeries(new Set());
    setExpandedSeasons(new Set());
  }, []);

  // Selection
  const handleSelectEpisode = useCallback((id: number, checked: boolean) => {
    setSelectedEpisodes(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  }, []);

  const selectAllInSeason = useCallback((catName: string, seriesName: string, seasonNum: number, select: boolean) => {
    const cat = categoryGroups.find(c => c.name === catName);
    const series = cat?.series.find(s => s.name === seriesName);
    const season = series?.seasons.find(s => s.number === seasonNum);
    if (!season) return;
    
    const ids = season.episodes.map(e => e.id);
    setSelectedEpisodes(prev => {
      if (select) {
        return [...new Set([...prev, ...ids])];
      } else {
        return prev.filter(id => !ids.includes(id));
      }
    });
  }, [categoryGroups]);

  const selectAllInSeries = useCallback((catName: string, seriesName: string, select: boolean) => {
    const cat = categoryGroups.find(c => c.name === catName);
    const series = cat?.series.find(s => s.name === seriesName);
    if (!series) return;
    
    const ids = series.seasons.flatMap(s => s.episodes.map(e => e.id));
    setSelectedEpisodes(prev => {
      if (select) {
        return [...new Set([...prev, ...ids])];
      } else {
        return prev.filter(id => !ids.includes(id));
      }
    });
  }, [categoryGroups]);

  // Auto-organize mutation
  const autoOrganizeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('auto_organize_series_channels');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const result = data?.[0];
      toast.success(`Organizados ${result?.organized_count || 0} canais em ${result?.series_found || 0} séries`);
      setIsAutoOrganizeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['iptv-series-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-unorganized-count'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Delete episodes mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from('iptv_channels').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Episódios excluídos');
      setSelectedEpisodes([]);
      queryClient.invalidateQueries({ queryKey: ['iptv-series-channels'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Move episodes to another series mutation
  const moveMutation = useMutation({
    mutationFn: async ({ episodeIds, seriesName, category }: { episodeIds: number[]; seriesName: string; category: string }) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ 
          series_name: seriesName,
          category: category || null,
        })
        .in('id', episodeIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Episódios movidos');
      setSelectedEpisodes([]);
      setIsMoveDialogOpen(false);
      setTargetSeriesName('');
      setTargetCategory('');
      queryClient.invalidateQueries({ queryKey: ['iptv-series-channels'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Rename series mutation
  const renameSeriesMutation = useMutation({
    mutationFn: async ({ category, oldName, newName }: { category: string; oldName: string; newName: string }) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ series_name: newName })
        .eq('series_name', oldName)
        .eq('category', category === 'Sem Categoria' ? null : category);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Série renomeada');
      setIsRenameSeriesOpen(false);
      setRenamingSeriesInfo(null);
      setNewSeriesName('');
      queryClient.invalidateQueries({ queryKey: ['iptv-series-channels'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const openRenameSeries = (category: string, seriesName: string) => {
    setRenamingSeriesInfo({ category, oldName: seriesName });
    setNewSeriesName(seriesName);
    setIsRenameSeriesOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Episódios</p>
                <p className="text-xl font-bold">{stats.totalEpisodes.toLocaleString()}</p>
              </div>
              <Film className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Séries</p>
                <p className="text-xl font-bold text-purple-500">{stats.totalSeries}</p>
              </div>
              <Clapperboard className="h-6 w-6 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Categorias</p>
                <p className="text-xl font-bold text-blue-500">{stats.totalCategories}</p>
              </div>
              <Folder className="h-6 w-6 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn(stats.unorganized > 0 && "border-orange-500/50")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Não Organizados</p>
                <p className="text-xl font-bold text-orange-500">{stats.unorganized.toLocaleString()}</p>
              </div>
              <Wand2 className="h-6 w-6 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar séries, episódios..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {/* View Mode Toggle */}
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'hierarchy' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setViewMode('hierarchy')}
                  >
                    <ListTree className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'flat' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setViewMode('flat')}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {viewMode === 'hierarchy' && (
                <>
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    Expandir Tudo
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    Recolher Tudo
                  </Button>
                  <div className="w-px h-6 bg-border hidden md:block" />
                </>
              )}
              
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Atualizar
              </Button>

              {stats.unorganized > 0 && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => setIsAutoOrganizeOpen(true)}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  Organizar {stats.unorganized.toLocaleString()} canais
                </Button>
              )}
            </div>

            {/* Bulk Actions */}
            {selectedEpisodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                <Badge variant="secondary" className="text-sm">
                  {selectedEpisodes.length} selecionado(s)
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setIsMoveDialogOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  Mover para Outra Série
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => deleteMutation.mutate(selectedEpisodes)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEpisodes([])}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Carregando séries...</p>
          </CardContent>
        </Card>
      ) : viewMode === 'hierarchy' ? (
        <div className="space-y-2">
          {categoryGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {stats.unorganized > 0 ? (
                  <div className="space-y-4">
                    <p>Nenhuma série organizada ainda.</p>
                    <Button onClick={() => setIsAutoOrganizeOpen(true)}>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Organizar Automaticamente
                    </Button>
                  </div>
                ) : (
                  <p>Nenhuma série encontrada</p>
                )}
              </CardContent>
            </Card>
          ) : (
            categoryGroups.map((category) => (
              <CategorySection
                key={category.name}
                category={category}
                isExpanded={expandedCategories.has(category.name)}
                onToggle={() => toggleCategory(category.name)}
                expandedSeries={expandedSeries}
                expandedSeasons={expandedSeasons}
                onToggleSeries={toggleSeries}
                onToggleSeason={toggleSeason}
                selectedEpisodes={selectedEpisodes}
                onSelectEpisode={handleSelectEpisode}
                onSelectSeason={selectAllInSeason}
                onSelectSeries={selectAllInSeries}
                onRenameSeries={openRenameSeries}
              />
            ))
          )}
        </div>
      ) : (
        /* Flat View */
        <Card>
          <ScrollArea className="max-h-[70vh]">
            <div className="divide-y">
              {(seriesChannels || []).map((channel) => (
                <EpisodeRow
                  key={channel.id}
                  episode={{
                    id: channel.id,
                    name: channel.name,
                    episode_number: channel.episode_number,
                    episode_title: channel.episode_title,
                    original_url: channel.original_url,
                    logo_url: channel.logo_url,
                    is_healthy: channel.is_healthy,
                  }}
                  seriesName={channel.series_name}
                  seasonNumber={channel.season_number}
                  category={channel.category}
                  isSelected={selectedEpisodes.includes(channel.id)}
                  onSelect={(checked) => handleSelectEpisode(channel.id, checked)}
                  showMeta
                />
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Auto-Organize Dialog */}
      <Dialog open={isAutoOrganizeOpen} onOpenChange={setIsAutoOrganizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organizar Séries Automaticamente</DialogTitle>
            <DialogDescription>
              O sistema irá analisar {stats.unorganized.toLocaleString()} canais e detectar automaticamente
              séries, temporadas e episódios baseado nos nomes (ex: S01E01, 1x01, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Padrões detectados: S01E01, 1x01, Temporada X Episódio Y, EP01
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAutoOrganizeOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => autoOrganizeMutation.mutate()} 
              disabled={autoOrganizeMutation.isPending}
            >
              {autoOrganizeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Wand2 className="h-4 w-4 mr-1" />
              )}
              Organizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Episodes Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Episódios</DialogTitle>
            <DialogDescription>
              Mova {selectedEpisodes.length} episódio(s) para outra série
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={targetCategory} onValueChange={setTargetCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem Categoria</SelectItem>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Série</label>
              <Select value={targetSeriesName} onValueChange={setTargetSeriesName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a série" />
                </SelectTrigger>
                <SelectContent>
                  {allSeriesNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ou criar nova:</span>
                <Input
                  placeholder="Nome da nova série"
                  value={allSeriesNames.includes(targetSeriesName) ? '' : targetSeriesName}
                  onChange={(e) => setTargetSeriesName(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => moveMutation.mutate({ 
                episodeIds: selectedEpisodes, 
                seriesName: targetSeriesName,
                category: targetCategory === '__none__' ? '' : targetCategory,
              })} 
              disabled={moveMutation.isPending || !targetSeriesName}
            >
              {moveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Series Dialog */}
      <Dialog open={isRenameSeriesOpen} onOpenChange={setIsRenameSeriesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Série</DialogTitle>
            <DialogDescription>
              Renomear "{renamingSeriesInfo?.oldName}" - isso atualizará todos os episódios
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Novo nome da série"
              value={newSeriesName}
              onChange={(e) => setNewSeriesName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameSeriesOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => renamingSeriesInfo && renameSeriesMutation.mutate({
                category: renamingSeriesInfo.category,
                oldName: renamingSeriesInfo.oldName,
                newName: newSeriesName.trim(),
              })}
              disabled={renameSeriesMutation.isPending || !newSeriesName.trim()}
            >
              {renameSeriesMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Category Section Component
interface CategorySectionProps {
  category: CategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSeries: Set<string>;
  expandedSeasons: Set<string>;
  onToggleSeries: (key: string) => void;
  onToggleSeason: (key: string) => void;
  selectedEpisodes: number[];
  onSelectEpisode: (id: number, checked: boolean) => void;
  onSelectSeason: (cat: string, series: string, season: number, select: boolean) => void;
  onSelectSeries: (cat: string, series: string, select: boolean) => void;
  onRenameSeries: (cat: string, series: string) => void;
}

function CategorySection({
  category,
  isExpanded,
  onToggle,
  expandedSeries,
  expandedSeasons,
  onToggleSeries,
  onToggleSeason,
  selectedEpisodes,
  onSelectEpisode,
  onSelectSeason,
  onSelectSeries,
  onRenameSeries,
}: CategorySectionProps) {
  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              <div className={cn("p-2 rounded-lg", isExpanded ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground")}>
                {isExpanded ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{category.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {category.totalSeries} série(s) • {category.totalEpisodes} episódio(s)
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-0 border-t">
            <div className="divide-y">
              {category.series.map((series) => (
                <SeriesSection
                  key={series.name}
                  categoryName={category.name}
                  series={series}
                  isExpanded={expandedSeries.has(`${category.name}|${series.name}`)}
                  onToggle={() => onToggleSeries(`${category.name}|${series.name}`)}
                  expandedSeasons={expandedSeasons}
                  onToggleSeason={onToggleSeason}
                  selectedEpisodes={selectedEpisodes}
                  onSelectEpisode={onSelectEpisode}
                  onSelectSeason={(season, select) => onSelectSeason(category.name, series.name, season, select)}
                  onSelectAll={(select) => onSelectSeries(category.name, series.name, select)}
                  onRename={() => onRenameSeries(category.name, series.name)}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Series Section Component
interface SeriesSectionProps {
  categoryName: string;
  series: Series;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSeasons: Set<string>;
  onToggleSeason: (key: string) => void;
  selectedEpisodes: number[];
  onSelectEpisode: (id: number, checked: boolean) => void;
  onSelectSeason: (season: number, select: boolean) => void;
  onSelectAll: (select: boolean) => void;
  onRename: () => void;
}

function SeriesSection({
  categoryName,
  series,
  isExpanded,
  onToggle,
  expandedSeasons,
  onToggleSeason,
  selectedEpisodes,
  onSelectEpisode,
  onSelectSeason,
  onSelectAll,
  onRename,
}: SeriesSectionProps) {
  const allEpisodeIds = series.seasons.flatMap(s => s.episodes.map(e => e.id));
  const selectedCount = allEpisodeIds.filter(id => selectedEpisodes.includes(id)).length;
  const isAllSelected = selectedCount === allEpisodeIds.length && allEpisodeIds.length > 0;

  return (
    <div className="pl-4 md:pl-8">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            
            {/* Series Logo */}
            <div className="flex-shrink-0">
              {series.logo_url ? (
                <img src={series.logo_url} alt="" className="w-10 h-14 rounded object-cover bg-muted" loading="lazy" />
              ) : (
                <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                  <Clapperboard className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{series.name}</h4>
              <p className="text-xs text-muted-foreground">
                {series.seasons.length} temporada(s) • {series.totalEpisodes} episódio(s)
                {selectedCount > 0 && <span className="ml-2 text-primary">• {selectedCount} selecionado(s)</span>}
              </p>
            </div>
            
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onRename}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Renomear Série
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="pl-4 md:pl-8 divide-y border-l ml-5">
            {series.seasons.map((season) => (
              <SeasonSection
                key={season.number}
                categoryName={categoryName}
                seriesName={series.name}
                season={season}
                isExpanded={expandedSeasons.has(`${categoryName}|${series.name}|${season.number}`)}
                onToggle={() => onToggleSeason(`${categoryName}|${series.name}|${season.number}`)}
                selectedEpisodes={selectedEpisodes}
                onSelectEpisode={onSelectEpisode}
                onSelectAll={(select) => onSelectSeason(season.number, select)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Season Section Component
interface SeasonSectionProps {
  categoryName: string;
  seriesName: string;
  season: Season;
  isExpanded: boolean;
  onToggle: () => void;
  selectedEpisodes: number[];
  onSelectEpisode: (id: number, checked: boolean) => void;
  onSelectAll: (select: boolean) => void;
}

function SeasonSection({
  season,
  isExpanded,
  onToggle,
  selectedEpisodes,
  onSelectEpisode,
  onSelectAll,
}: SeasonSectionProps) {
  const episodeIds = season.episodes.map(e => e.id);
  const selectedCount = episodeIds.filter(id => selectedEpisodes.includes(id)).length;
  const isAllSelected = selectedCount === episodeIds.length && episodeIds.length > 0;

  return (
    <div>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            
            <div className="p-1.5 rounded bg-purple-500/10 text-purple-500">
              <Calendar className="h-4 w-4" />
            </div>
            
            <div className="flex-1">
              <span className="font-medium text-sm">Temporada {season.number}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {season.episodes.length} episódio(s)
                {selectedCount > 0 && <span className="text-primary ml-1">• {selectedCount}</span>}
              </span>
            </div>
            
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="pl-8 divide-y border-l ml-3">
            {season.episodes.map((episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                isSelected={selectedEpisodes.includes(episode.id)}
                onSelect={(checked) => onSelectEpisode(episode.id, checked)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Episode Row Component
interface EpisodeRowProps {
  episode: Episode;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  seriesName?: string | null;
  seasonNumber?: number;
  category?: string | null;
  showMeta?: boolean;
}

function EpisodeRow({ episode, isSelected, onSelect, seriesName, seasonNumber, category, showMeta }: EpisodeRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-2 hover:bg-muted/30 transition-colors",
      isSelected && "bg-primary/5"
    )}>
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(!!checked)}
      />
      
      <div className="p-1.5 rounded bg-muted">
        <Hash className="h-3 w-3 text-muted-foreground" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">E{episode.episode_number.toString().padStart(2, '0')}</span>
          {episode.episode_title && (
            <span className="text-sm text-muted-foreground truncate">{episode.episode_title}</span>
          )}
        </div>
        {showMeta && (
          <p className="text-xs text-muted-foreground">
            {seriesName} • S{(seasonNumber || 1).toString().padStart(2, '0')} • {category || 'Sem Categoria'}
          </p>
        )}
      </div>
      
      <Badge variant={episode.is_healthy ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
        {episode.is_healthy ? 'OK' : 'Falha'}
      </Badge>
      
      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
        <a href={episode.original_url} target="_blank" rel="noopener noreferrer">
          <Play className="h-3 w-3" />
        </a>
      </Button>
    </div>
  );
}
