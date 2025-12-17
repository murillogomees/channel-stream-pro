/**
 * IPTV Channels Tab - Category-grouped channel management with series grouping
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  Plus, Search, RefreshCw, Trash2, Edit, 
  CheckCircle, XCircle, Loader2, Upload, Tv, Film, 
  ChevronDown, ChevronRight, FolderOpen, Folder, 
  MoreVertical, Pencil, X, 
  List, FolderTree, ArrowRightLeft, Clapperboard, Wand2
} from 'lucide-react';
import { IPTVChannelForm } from '@/components/admin/iptv/IPTVChannelForm';
import { IPTVChannelImport } from '@/components/admin/iptv/IPTVChannelImport';
import { IPTVStatCard, IPTVStatsGrid } from '@/components/admin/iptv/IPTVStatsCards';
import { useChannelStats } from '@/hooks/useIPTVRealtimeStats';
import { cn } from '@/lib/utils';

interface Channel {
  id: number;
  slug: string;
  name: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  content_type: string;
  is_healthy: boolean;
  health_score: number;
  transcode_status: string;
  last_probe_at: string | null;
  created_at: string;
  // Series fields
  series_name: string | null;
  season_number: number | null;
  episode_number: number | null;
  is_series: boolean | null;
}

interface SeriesGroup {
  seriesName: string;
  channels: Channel[];
  logo_url: string | null;
}

interface CategoryGroup {
  name: string;
  channels: Channel[];
  seriesGroups: SeriesGroup[];
  standaloneChannels: Channel[];
  count: number;
}

type ViewMode = 'categories' | 'list';


export function IPTVChannelsTab() {
  const queryClient = useQueryClient();
  const { data: realtimeStats, isLoading: statsLoading } = useChannelStats();
  
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameCategoryOpen, setIsRenameCategoryOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [isAutoOrganizeOpen, setIsAutoOrganizeOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Fetch all channels with pagination to bypass 1000 row limit
  const { data: allChannels, isLoading, refetch } = useQuery({
    queryKey: ['iptv-channels-all', search, healthFilter, typeFilter],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: Channel[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('iptv_channels')
          .select('*')
          .order('category', { ascending: true, nullsFirst: false })
          .order('series_name', { ascending: true, nullsFirst: false })
          .order('season_number', { ascending: true })
          .order('episode_number', { ascending: true })
          .order('name', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (search) {
          query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,category.ilike.%${search}%,series_name.ilike.%${search}%`);
        }
        if (healthFilter !== 'all') {
          query = query.eq('is_healthy', healthFilter === 'healthy');
        }
        if (typeFilter !== 'all') {
          query = query.eq('content_type', typeFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allData as Channel[];
    },
  });


  // Group channels by category, then by series
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    if (!allChannels) return [];
    
    const catMap = new Map<string, Channel[]>();
    
    allChannels.forEach(channel => {
      const cat = channel.category || 'Sem Categoria';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(channel);
    });
    
    return Array.from(catMap.entries()).map(([name, channels]) => {
      // Group by series within category
      const seriesMap = new Map<string, Channel[]>();
      const standalone: Channel[] = [];
      
      channels.forEach(ch => {
        if (ch.is_series && ch.series_name) {
          if (!seriesMap.has(ch.series_name)) seriesMap.set(ch.series_name, []);
          seriesMap.get(ch.series_name)!.push(ch);
        } else {
          standalone.push(ch);
        }
      });
      
      const seriesGroups: SeriesGroup[] = Array.from(seriesMap.entries())
        .map(([seriesName, chs]) => ({
          seriesName,
          channels: chs.sort((a, b) => {
            const sA = a.season_number || 0, sB = b.season_number || 0;
            if (sA !== sB) return sA - sB;
            return (a.episode_number || 0) - (b.episode_number || 0);
          }),
          logo_url: chs.find(c => c.logo_url)?.logo_url || null,
        }))
        .sort((a, b) => a.seriesName.localeCompare(b.seriesName));
      
      return {
        name,
        channels,
        seriesGroups,
        standaloneChannels: standalone,
        count: channels.length,
      };
    }).sort((a, b) => {
      if (a.name === 'Sem Categoria') return 1;
      if (b.name === 'Sem Categoria') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [allChannels]);

  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    (allChannels || []).forEach((c) => {
      if (c.category) categories.add(c.category);
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [allChannels]);

  const stats = useMemo(() => {
    if (!allChannels) return { total: 0, healthy: 0, unhealthy: 0, categories: 0, series: 0 };
    const seriesCount = new Set(allChannels.filter(c => c.series_name).map(c => c.series_name)).size;
    const categoriesCount = new Set(allChannels.map(c => c.category).filter((c): c is string => !!c)).size;
    return {
      total: allChannels.length,
      healthy: allChannels.filter(c => c.is_healthy).length,
      unhealthy: allChannels.filter(c => !c.is_healthy).length,
      categories: categoriesCount,
      series: seriesCount,
    };
  }, [allChannels]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
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

  const expandAll = useCallback(() => {
    const cats = new Set(categoryGroups.map(g => g.name));
    const series = new Set<string>();
    categoryGroups.forEach(cat => {
      cat.seriesGroups.forEach(s => series.add(`${cat.name}|${s.seriesName}`));
    });
    setExpandedCategories(cats);
    setExpandedSeries(series);
  }, [categoryGroups]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
    setExpandedSeries(new Set());
  }, []);

  const selectSeriesChannels = useCallback((catName: string, seriesName: string, select: boolean) => {
    const cat = categoryGroups.find(g => g.name === catName);
    const series = cat?.seriesGroups.find(s => s.seriesName === seriesName);
    if (!series) return;
    
    const ids = series.channels.map(c => c.id);
    setSelectedChannels(prev => {
      if (select) return [...new Set([...prev, ...ids])];
      return prev.filter(id => !ids.includes(id));
    });
  }, [categoryGroups]);

  const selectCategoryChannels = useCallback((category: string, select: boolean) => {
    const group = categoryGroups.find(g => g.name === category);
    if (!group) return;
    
    const ids = group.channels.map(c => c.id);
    setSelectedChannels(prev => {
      if (select) return [...new Set([...prev, ...ids])];
      return prev.filter(id => !ids.includes(id));
    });
  }, [categoryGroups]);

  const isCategorySelected = useCallback((category: string) => {
    const group = categoryGroups.find(g => g.name === category);
    if (!group || group.channels.length === 0) return false;
    return group.channels.every(c => selectedChannels.includes(c.id));
  }, [categoryGroups, selectedChannels]);

  const isSeriesSelected = useCallback((catName: string, seriesName: string) => {
    const cat = categoryGroups.find(g => g.name === catName);
    const series = cat?.seriesGroups.find(s => s.seriesName === seriesName);
    if (!series || series.channels.length === 0) return false;
    return series.channels.every(c => selectedChannels.includes(c.id));
  }, [categoryGroups, selectedChannels]);

  const handleSelectChannel = useCallback((id: number, checked: boolean) => {
    setSelectedChannels(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  }, []);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from('iptv_channels').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Canais excluídos');
      setSelectedChannels([]);
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ channelIds, category }: { channelIds: number[]; category: string }) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ category: category || null })
        .in('id', channelIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Canais movidos');
      setSelectedChannels([]);
      setIsMoveDialogOpen(false);
      setTargetCategory('');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ category: newName })
        .eq('category', oldName);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoria renomeada');
      setIsRenameCategoryOpen(false);
      setRenamingCategory(null);
      setNewCategoryName('');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ category: null })
        .eq('category', categoryName);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoria removida');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

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
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-series-channels'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      // Ordem importa por causa de chaves estrangeiras
      // Tabelas que existem no schema atual
      const steps = [
        { table: 'iptv_channel_metrics', query: () => supabase.from('iptv_channel_metrics').delete().gt('id', 0) },
        { table: 'iptv_cdn_cache', query: () => supabase.from('iptv_cdn_cache').delete().gt('id', 0) },
        { table: 'iptv_transcode_jobs', query: () => supabase.from('iptv_transcode_jobs').delete().gt('id', 0) },
        { table: 'iptv_probe_jobs', query: () => supabase.from('iptv_probe_jobs').delete().gt('id', 0) },
        { table: 'epg_programs', query: () => supabase.from('epg_programs').delete().not('id', 'is', null) },
        { table: 'iptv_playlist_channels', query: () => supabase.from('iptv_playlist_channels').delete().gt('playlist_id', 0) },
        { table: 'iptv_playlists', query: () => supabase.from('iptv_playlists').delete().gt('id', 0) },
        { table: 'iptv_channels', query: () => supabase.from('iptv_channels').delete().gt('id', 0) },
      ];

      for (const step of steps) {
        const { error } = await step.query();
        // Ignora erros de tabela não encontrada
        if (error && !error.message.includes('schema cache')) throw error;
      }
    },
    onSuccess: () => {
      toast.success('IPTV limpo: todos os dados foram removidos');
      setSelectedChannels([]);
      setExpandedCategories(new Set());
      setExpandedSeries(new Set());
      setIsResetOpen(false);
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('iptv') });
      refetch();
    },
    onError: (error) => toast.error(`Erro ao limpar: ${error.message}`),
  });

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'live': return <Tv className="h-4 w-4" />;
      case 'vod': return <Film className="h-4 w-4" />;
      case 'series': return <Clapperboard className="h-4 w-4" />;
      default: return <Tv className="h-4 w-4" />;
    }
  };

  const openRenameCategory = (category: string) => {
    setRenamingCategory(category);
    setNewCategoryName(category);
    setIsRenameCategoryOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Stats - Realtime */}
      <IPTVStatsGrid columns={5}>
        <IPTVStatCard label="Total" value={realtimeStats?.total || 0} icon={Tv} loading={statsLoading} />
        <IPTVStatCard label="Categorias" value={realtimeStats?.categories || 0} icon={FolderTree} color="purple" loading={statsLoading} />
        <IPTVStatCard label="Séries" value={realtimeStats?.series || 0} icon={Clapperboard} color="blue" loading={statsLoading} />
        <IPTVStatCard label="Saudáveis" value={realtimeStats?.healthy || 0} icon={CheckCircle} color="green" loading={statsLoading} />
        <IPTVStatCard label="Com Falha" value={realtimeStats?.unhealthy || 0} icon={XCircle} color="red" loading={statsLoading} />
      </IPTVStatsGrid>

      {/* Actions Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar canais, séries ou categorias..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={healthFilter} onValueChange={setHealthFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="healthy">Saudável</SelectItem>
                    <SelectItem value="unhealthy">Falha</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="vod">VOD</SelectItem>
                    <SelectItem value="series">Séries</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'categories' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setViewMode('categories')}
                  >
                    <FolderTree className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewMode === 'categories' && (
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

              <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={resetAllMutation.isPending}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpar IPTV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Apagar tudo do IPTV</DialogTitle>
                    <DialogDescription>
                      Isso vai remover canais, playlists, EPG, jobs e cache relacionados ao IPTV. Essa ação não pode ser desfeita.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsResetOpen(false)} disabled={resetAllMutation.isPending}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={() => resetAllMutation.mutate()} disabled={resetAllMutation.isPending}>
                      {resetAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      Apagar tudo
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="default" size="sm" onClick={() => setIsAutoOrganizeOpen(true)} className="bg-orange-500 hover:bg-orange-600">
                <Wand2 className="h-4 w-4 mr-1" />
                Auto-Organizar Séries
              </Button>
              
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Importar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Importar M3U</DialogTitle>
                  </DialogHeader>
                  <IPTVChannelImport onSuccess={() => { setIsImportOpen(false); refetch(); }} />
                </DialogContent>
              </Dialog>

              <Dialog open={isFormOpen} onOpenChange={(open) => {
                setIsFormOpen(open);
                if (!open) setEditingChannel(null);
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Novo Canal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingChannel ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
                  </DialogHeader>
                  <IPTVChannelForm 
                    channel={editingChannel}
                    onSuccess={() => { setIsFormOpen(false); setEditingChannel(null); refetch(); }}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {selectedChannels.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                <Badge variant="secondary" className="text-sm">
                  {selectedChannels.length} selecionado(s)
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setIsMoveDialogOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  Mover para Categoria
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => deleteMutation.mutate(selectedChannels)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedChannels([])}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar Seleção
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
            <p className="text-muted-foreground">Carregando canais...</p>
          </CardContent>
        </Card>
      ) : viewMode === 'categories' ? (
        <div className="space-y-2">
          {categoryGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum canal encontrado
              </CardContent>
            </Card>
          ) : (
            categoryGroups.map((group) => (
              <CategoryCard
                key={group.name}
                group={group}
                isExpanded={expandedCategories.has(group.name)}
                onToggle={() => toggleCategory(group.name)}
                expandedSeries={expandedSeries}
                onToggleSeries={toggleSeries}
                selectedChannels={selectedChannels}
                onSelectChannel={handleSelectChannel}
                onSelectSeries={selectSeriesChannels}
                onSelectAll={(select) => selectCategoryChannels(group.name, select)}
                isAllSelected={isCategorySelected(group.name)}
                isSeriesSelected={isSeriesSelected}
                onEditChannel={(channel) => { setEditingChannel(channel); setIsFormOpen(true); }}
                onDeleteChannel={(id) => deleteMutation.mutate([id])}
                onRenameCategory={() => openRenameCategory(group.name)}
                onDeleteCategory={() => deleteCategoryMutation.mutate(group.name)}
                getContentTypeIcon={getContentTypeIcon}
              />
            ))
          )}
        </div>
      ) : (
        <Card>
          <ScrollArea className="w-full max-h-[70vh]">
            <div className="divide-y">
              {(allChannels || []).map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannels.includes(channel.id)}
                  onSelect={(checked) => handleSelectChannel(channel.id, checked)}
                  onEdit={() => { setEditingChannel(channel); setIsFormOpen(true); }}
                  onDelete={() => deleteMutation.mutate([channel.id])}
                  getContentTypeIcon={getContentTypeIcon}
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
            <DialogTitle>Auto-Organizar Séries</DialogTitle>
            <DialogDescription>
              Detecta automaticamente séries nos canais baseado em padrões de nome (S01E01, S01 E01, 1x01, EP01, etc.)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAutoOrganizeOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => autoOrganizeMutation.mutate()} 
              disabled={autoOrganizeMutation.isPending}
            >
              {autoOrganizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
              Organizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Canais</DialogTitle>
            <DialogDescription>
              Mova {selectedChannels.length} canal(is) para outra categoria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={targetCategory} onValueChange={setTargetCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria de destino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem Categoria</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ou criar nova:</span>
              <Input
                placeholder="Nome da nova categoria"
                value={targetCategory.startsWith('__') ? '' : (allCategories.includes(targetCategory) ? '' : targetCategory)}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => moveMutation.mutate({ 
                channelIds: selectedChannels, 
                category: targetCategory === '__none__' ? '' : targetCategory 
              })} 
              disabled={moveMutation.isPending}
            >
              {moveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Category Dialog */}
      <Dialog open={isRenameCategoryOpen} onOpenChange={setIsRenameCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Categoria</DialogTitle>
            <DialogDescription>
              Renomear "{renamingCategory}" - isso atualizará todos os canais
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Novo nome da categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameCategoryOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => renamingCategory && renameCategoryMutation.mutate({ oldName: renamingCategory, newName: newCategoryName.trim() })}
              disabled={renameCategoryMutation.isPending}
            >
              {renameCategoryMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Category Card Component
interface CategoryCardProps {
  group: CategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSeries: Set<string>;
  onToggleSeries: (key: string) => void;
  selectedChannels: number[];
  onSelectChannel: (id: number, checked: boolean) => void;
  onSelectSeries: (cat: string, series: string, select: boolean) => void;
  onSelectAll: (select: boolean) => void;
  isAllSelected: boolean;
  isSeriesSelected: (cat: string, series: string) => boolean;
  onEditChannel: (channel: Channel) => void;
  onDeleteChannel: (id: number) => void;
  onRenameCategory: () => void;
  onDeleteCategory: () => void;
  getContentTypeIcon: (type: string) => React.ReactNode;
}

function CategoryCard({
  group,
  isExpanded,
  onToggle,
  expandedSeries,
  onToggleSeries,
  selectedChannels,
  onSelectChannel,
  onSelectSeries,
  onSelectAll,
  isAllSelected,
  isSeriesSelected,
  onEditChannel,
  onDeleteChannel,
  onRenameCategory,
  onDeleteCategory,
  getContentTypeIcon,
}: CategoryCardProps) {
  const selectedCount = group.channels.filter(c => selectedChannels.includes(c.id)).length;
  const isUncategorized = group.name === 'Sem Categoria';

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-3 md:p-4">
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground">
                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              <div className={cn("p-2 rounded-lg", isExpanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {isExpanded ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{group.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {group.count} canal(is)
                  {group.seriesGroups.length > 0 && ` • ${group.seriesGroups.length} série(s)`}
                  {selectedCount > 0 && <span className="ml-2 text-primary">• {selectedCount} selecionado(s)</span>}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={isAllSelected} onCheckedChange={(checked) => onSelectAll(!!checked)} className="mr-2" />
                {!isUncategorized && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={onRenameCategory}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onDeleteCategory} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover Categoria
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-0 border-t">
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {/* Series Groups */}
                {group.seriesGroups.map((series) => (
                  <SeriesGroupRow
                    key={series.seriesName}
                    categoryName={group.name}
                    series={series}
                    isExpanded={expandedSeries.has(`${group.name}|${series.seriesName}`)}
                    onToggle={() => onToggleSeries(`${group.name}|${series.seriesName}`)}
                    selectedChannels={selectedChannels}
                    onSelectChannel={onSelectChannel}
                    onSelectAll={(select) => onSelectSeries(group.name, series.seriesName, select)}
                    isAllSelected={isSeriesSelected(group.name, series.seriesName)}
                    onEditChannel={onEditChannel}
                    onDeleteChannel={onDeleteChannel}
                    getContentTypeIcon={getContentTypeIcon}
                  />
                ))}
                
                {/* Standalone Channels */}
                {group.standaloneChannels.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannels.includes(channel.id)}
                    onSelect={(checked) => onSelectChannel(channel.id, checked)}
                    onEdit={() => onEditChannel(channel)}
                    onDelete={() => onDeleteChannel(channel.id)}
                    getContentTypeIcon={getContentTypeIcon}
                    compact
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Series Group Row Component
interface SeriesGroupRowProps {
  categoryName: string;
  series: SeriesGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedChannels: number[];
  onSelectChannel: (id: number, checked: boolean) => void;
  onSelectAll: (select: boolean) => void;
  isAllSelected: boolean;
  onEditChannel: (channel: Channel) => void;
  onDeleteChannel: (id: number) => void;
  getContentTypeIcon: (type: string) => React.ReactNode;
}

function SeriesGroupRow({
  series,
  isExpanded,
  onToggle,
  selectedChannels,
  onSelectChannel,
  onSelectAll,
  isAllSelected,
  onEditChannel,
  onDeleteChannel,
  getContentTypeIcon,
}: SeriesGroupRowProps) {
  const selectedCount = series.channels.filter(c => selectedChannels.includes(c.id)).length;

  return (
    <div className="bg-muted/30">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            
<div className="w-10 h-14 rounded bg-muted flex items-center justify-center overflow-hidden">
              {series.logo_url ? (
                <img 
                  src={series.logo_url} 
                  alt="" 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : null}
              <Clapperboard className="h-5 w-5 text-muted-foreground" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-500 border-blue-500/30">
                  SÉRIE
                </Badge>
                <span className="font-medium truncate">{series.seriesName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {series.channels.length} episódio(s)
                {selectedCount > 0 && <span className="ml-2 text-primary">• {selectedCount} selecionado(s)</span>}
              </p>
            </div>
            
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={isAllSelected} onCheckedChange={(checked) => onSelectAll(!!checked)} />
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="pl-8 divide-y border-l ml-5">
            {series.channels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                isSelected={selectedChannels.includes(channel.id)}
                onSelect={(checked) => onSelectChannel(channel.id, checked)}
                onEdit={() => onEditChannel(channel)}
                onDelete={() => onDeleteChannel(channel.id)}
                getContentTypeIcon={getContentTypeIcon}
                compact
                showEpisodeInfo
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Channel Row Component
interface ChannelRowProps {
  channel: Channel;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  getContentTypeIcon: (type: string) => React.ReactNode;
  compact?: boolean;
  showEpisodeInfo?: boolean;
}

function ChannelRow({
  channel,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getContentTypeIcon,
  compact = false,
  showEpisodeInfo = false,
}: ChannelRowProps) {
  const episodeLabel = showEpisodeInfo && channel.season_number && channel.episode_number
    ? `S${String(channel.season_number).padStart(2, '0')}E${String(channel.episode_number).padStart(2, '0')}`
    : null;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors",
      isSelected && "bg-primary/5"
    )}>
      <Checkbox checked={isSelected} onCheckedChange={(checked) => onSelect(!!checked)} />
      
      <div className="flex-shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
        {channel.logo_url ? (
          <img 
            src={channel.logo_url} 
            alt="" 
            className="w-full h-full object-cover" 
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : null}
        <span className="text-muted-foreground">{getContentTypeIcon(channel.content_type)}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {episodeLabel && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{episodeLabel}</Badge>
          )}
          <p className="font-medium truncate text-sm">{channel.name}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!compact && channel.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{channel.category}</Badge>
          )}
          <Badge variant={channel.is_healthy ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
            {channel.is_healthy ? 'OK' : 'Falha'}
          </Badge>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
