/**
 * IPTV Channels Tab - Category-grouped channel management with intuitive UX
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  Plus, Search, RefreshCw, Trash2, Edit, Play, 
  CheckCircle, XCircle, Loader2, Upload, Tv, Radio, Film, 
  ChevronDown, ChevronRight, FolderOpen, Folder, 
  MoveRight, MoreVertical, Pencil, Check, X, 
  Grid3X3, List, FolderTree, ArrowRightLeft
} from 'lucide-react';
import { IPTVChannelForm } from '@/components/admin/iptv/IPTVChannelForm';
import { IPTVChannelImport } from '@/components/admin/iptv/IPTVChannelImport';
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
}

interface CategoryGroup {
  name: string;
  channels: Channel[];
  count: number;
}

type ViewMode = 'categories' | 'list';

export function IPTVChannelsTab() {
  const queryClient = useQueryClient();
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Selection state
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isRenameCategoryOpen, setIsRenameCategoryOpen] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [targetCategory, setTargetCategory] = useState<string>('');

  // Fetch all channels (grouped by category)
  const { data: allChannels, isLoading, refetch } = useQuery({
    queryKey: ['iptv-channels-all', search, healthFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('iptv_channels')
        .select('*')
        .order('category', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,category.ilike.%${search}%`);
      }
      if (healthFilter !== 'all') {
        query = query.eq('is_healthy', healthFilter === 'healthy');
      }
      if (typeFilter !== 'all') {
        query = query.eq('content_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Channel[];
    },
  });

  // Group channels by category
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    if (!allChannels) return [];
    
    const groups = new Map<string, Channel[]>();
    
    allChannels.forEach(channel => {
      const cat = channel.category || 'Sem Categoria';
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat)!.push(channel);
    });
    
    return Array.from(groups.entries())
      .map(([name, channels]) => ({ name, channels, count: channels.length }))
      .sort((a, b) => {
        if (a.name === 'Sem Categoria') return 1;
        if (b.name === 'Sem Categoria') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [allChannels]);

  // Get unique categories for move dialog
  const allCategories = useMemo(() => {
    return categoryGroups.map(g => g.name).filter(n => n !== 'Sem Categoria');
  }, [categoryGroups]);

  // Stats
  const stats = useMemo(() => {
    if (!allChannels) return { total: 0, healthy: 0, unhealthy: 0, categories: 0 };
    return {
      total: allChannels.length,
      healthy: allChannels.filter(c => c.is_healthy).length,
      unhealthy: allChannels.filter(c => !c.is_healthy).length,
      categories: categoryGroups.length,
    };
  }, [allChannels, categoryGroups]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(categoryGroups.map(g => g.name)));
  }, [categoryGroups]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  // Select all channels in a category
  const selectCategoryChannels = useCallback((category: string, select: boolean) => {
    const group = categoryGroups.find(g => g.name === category);
    if (!group) return;
    
    setSelectedChannels(prev => {
      const categoryIds = new Set(group.channels.map(c => c.id));
      if (select) {
        return [...new Set([...prev, ...Array.from(categoryIds)])];
      } else {
        return prev.filter(id => !categoryIds.has(id));
      }
    });
  }, [categoryGroups]);

  // Check if all channels in category are selected
  const isCategorySelected = useCallback((category: string) => {
    const group = categoryGroups.find(g => g.name === category);
    if (!group || group.channels.length === 0) return false;
    return group.channels.every(c => selectedChannels.includes(c.id));
  }, [categoryGroups, selectedChannels]);

  // Channel selection
  const handleSelectChannel = useCallback((id: number, checked: boolean) => {
    setSelectedChannels(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  }, []);

  // Delete mutation
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

  // Move channels to category mutation
  const moveMutation = useMutation({
    mutationFn: async ({ channelIds, category }: { channelIds: number[]; category: string }) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ category: category || null })
        .in('id', channelIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Canais movidos com sucesso');
      setSelectedChannels([]);
      setIsMoveDialogOpen(false);
      setTargetCategory('');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Rename category mutation
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ category: newName })
        .eq('category', oldName);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoria renomeada com sucesso');
      setIsRenameCategoryOpen(false);
      setRenamingCategory(null);
      setNewCategoryName('');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Delete entire category (moves channels to "Sem Categoria")
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      const { error } = await supabase
        .from('iptv_channels')
        .update({ category: null })
        .eq('category', categoryName);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoria removida (canais movidos para "Sem Categoria")');
      queryClient.invalidateQueries({ queryKey: ['iptv-channels-all'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'live': return <Tv className="h-4 w-4" />;
      case 'vod': return <Film className="h-4 w-4" />;
      case 'series': return <Radio className="h-4 w-4" />;
      default: return <Tv className="h-4 w-4" />;
    }
  };

  const handleMoveSelected = () => {
    if (selectedChannels.length === 0) {
      toast.error('Selecione pelo menos um canal');
      return;
    }
    setIsMoveDialogOpen(true);
  };

  const handleConfirmMove = () => {
    if (!targetCategory) {
      toast.error('Selecione uma categoria de destino');
      return;
    }
    moveMutation.mutate({ 
      channelIds: selectedChannels, 
      category: targetCategory === '__none__' ? '' : targetCategory 
    });
  };

  const openRenameCategory = (category: string) => {
    setRenamingCategory(category);
    setNewCategoryName(category);
    setIsRenameCategoryOpen(true);
  };

  const handleConfirmRename = () => {
    if (!renamingCategory || !newCategoryName.trim()) {
      toast.error('Digite um nome válido');
      return;
    }
    renameCategoryMutation.mutate({ oldName: renamingCategory, newName: newCategoryName.trim() });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <Tv className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Categorias</p>
                <p className="text-xl font-bold text-purple-500">{stats.categories}</p>
              </div>
              <FolderTree className="h-6 w-6 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saudáveis</p>
                <p className="text-xl font-bold text-green-500">{stats.healthy.toLocaleString()}</p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Com Falha</p>
                <p className="text-xl font-bold text-red-500">{stats.unhealthy.toLocaleString()}</p>
              </div>
              <XCircle className="h-6 w-6 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            {/* Search & Filters Row */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar canais ou categorias..."
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

                {/* View Mode Toggle */}
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

            {/* Actions Row */}
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

            {/* Bulk Actions (when channels selected) */}
            {selectedChannels.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                <Badge variant="secondary" className="text-sm">
                  {selectedChannels.length} selecionado(s)
                </Badge>
                <Button variant="outline" size="sm" onClick={handleMoveSelected}>
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
        /* Category View */
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
                selectedChannels={selectedChannels}
                onSelectChannel={handleSelectChannel}
                onSelectAll={(select) => selectCategoryChannels(group.name, select)}
                isAllSelected={isCategorySelected(group.name)}
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
        /* List View */
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
            <Button onClick={handleConfirmMove} disabled={moveMutation.isPending}>
              {moveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
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
              Renomear "{renamingCategory}" - isso atualizará todos os canais desta categoria
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
            <Button onClick={handleConfirmRename} disabled={renameCategoryMutation.isPending}>
              {renameCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
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
  selectedChannels: number[];
  onSelectChannel: (id: number, checked: boolean) => void;
  onSelectAll: (select: boolean) => void;
  isAllSelected: boolean;
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
  selectedChannels,
  onSelectChannel,
  onSelectAll,
  isAllSelected,
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
              {/* Expand Icon */}
              <div className="text-muted-foreground">
                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              
              {/* Folder Icon */}
              <div className={cn(
                "p-2 rounded-lg",
                isExpanded ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {isExpanded ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
              </div>
              
              {/* Category Name */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{group.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {group.count} canal(is)
                  {selectedCount > 0 && (
                    <span className="ml-2 text-primary">• {selectedCount} selecionado(s)</span>
                  )}
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                  className="mr-2"
                />
                
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
                        Renomear Categoria
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
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {group.channels.map((channel) => (
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

// Channel Row Component
interface ChannelRowProps {
  channel: Channel;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  getContentTypeIcon: (type: string) => React.ReactNode;
  compact?: boolean;
}

function ChannelRow({
  channel,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getContentTypeIcon,
  compact = false,
}: ChannelRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors",
      isSelected && "bg-primary/5"
    )}>
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(!!checked)}
      />
      
      {/* Logo */}
      <div className="flex-shrink-0">
        {channel.logo_url ? (
          <img 
            src={channel.logo_url} 
            alt="" 
            className="w-10 h-10 rounded object-cover bg-muted"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
            {getContentTypeIcon(channel.content_type)}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{channel.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!compact && channel.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {channel.category}
            </Badge>
          )}
          <Badge 
            variant={channel.is_healthy ? 'default' : 'destructive'} 
            className="text-[10px] px-1.5 py-0"
          >
            {channel.is_healthy ? 'OK' : 'Falha'}
          </Badge>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive hover:text-destructive" 
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
