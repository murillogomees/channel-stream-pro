import { useState, useEffect } from 'react';
import { 
  Search, Tv, Film, Clapperboard, MoreHorizontal, 
  Edit, Trash2, FolderInput, ChevronDown, ChevronRight,
  Loader2, RefreshCw, Save, X, Check, ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { useM3USyncEditor, ContentClass, M3UEntry, CategoryGroup, CLASS_LABELS } from '@/hooks/useM3USyncEditor';
import { useM3USync } from '@/hooks/useM3USync';
import { toast } from '@/hooks/use-toast';

const CLASS_ICONS: Record<ContentClass, typeof Tv> = {
  tv: Tv,
  movies: Film,
  series: Clapperboard,
  other: MoreHorizontal,
};

const CLASS_COLORS: Record<ContentClass, string> = {
  tv: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  movies: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  series: 'bg-green-500/10 text-green-500 border-green-500/20',
  other: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default function AdminM3UContentEditor() {
  const { sources, fetchSources } = useM3USync();
  const {
    entries,
    groupedData,
    allCategories,
    stats,
    isLoading,
    selectedSourceId,
    searchQuery,
    selectedClass,
    selectedCategory,
    setSearchQuery,
    setSelectedClass,
    setSelectedCategory,
    loadEntries,
    updateEntry,
    bulkUpdateCategory,
    deleteEntry,
    renameCategory,
    moveCategoryToClass,
  } = useM3USyncEditor();

  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<M3UEntry | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState('');

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleSourceChange = (sourceId: string) => {
    setSelectedEntries(new Set());
    setExpandedCategories(new Set());
    loadEntries(sourceId);
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const selectAllInCategory = (category: CategoryGroup) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      const allSelected = category.entries.every(e => next.has(e.id));
      
      if (allSelected) {
        category.entries.forEach(e => next.delete(e.id));
      } else {
        category.entries.forEach(e => next.add(e.id));
      }
      return next;
    });
  };

  const handleMoveSelected = async () => {
    if (selectedEntries.size === 0 || !targetCategory) return;
    
    await bulkUpdateCategory(Array.from(selectedEntries), targetCategory);
    setSelectedEntries(new Set());
    setMoveDialogOpen(false);
    setTargetCategory('');
  };

  const handleRenameCategory = async () => {
    if (!editingCategory || !newCategoryName.trim()) return;
    
    await renameCategory(editingCategory, newCategoryName.trim());
    setEditingCategory(null);
    setNewCategoryName('');
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;
    
    await updateEntry(editingEntry.id, {
      title: editingEntry.title,
      group_title: editingEntry.group_title,
      tvg_name: editingEntry.tvg_name,
      tvg_logo: editingEntry.tvg_logo,
      tvg_id: editingEntry.tvg_id,
    });
    setEditingEntry(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Editor de Conteúdo M3U</h2>
          <p className="text-sm text-muted-foreground">
            Organize e edite entradas diretamente das fontes sincronizadas
          </p>
        </div>
        
        <div className="flex gap-2 items-center w-full sm:w-auto">
          {selectedSourceId && (
            <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-600/30 bg-green-500/10">
              <Check className="w-3 h-3" />
              Auto-save ativo
            </Badge>
          )}
          <Select onValueChange={handleSourceChange} value={selectedSourceId || ''}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Selecione uma fonte" />
            </SelectTrigger>
            <SelectContent>
              {sources.filter(s => s.enabled).map(source => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name} ({source.entries_count.toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      {selectedSourceId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardDescription className="text-xs">Total</CardDescription>
              <CardTitle className="text-xl">{stats.total.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={CLASS_COLORS.tv}>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardDescription className="text-xs flex items-center gap-1">
                <Tv className="w-3 h-3" /> TV ao Vivo
              </CardDescription>
              <CardTitle className="text-xl">{stats.tv.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={CLASS_COLORS.movies}>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardDescription className="text-xs flex items-center gap-1">
                <Film className="w-3 h-3" /> Filmes
              </CardDescription>
              <CardTitle className="text-xl">{stats.movies.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={CLASS_COLORS.series}>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardDescription className="text-xs flex items-center gap-1">
                <Clapperboard className="w-3 h-3" /> Séries
              </CardDescription>
              <CardTitle className="text-xl">{stats.series.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={CLASS_COLORS.other}>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardDescription className="text-xs">Outros</CardDescription>
              <CardTitle className="text-xl">{stats.other.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardDescription className="text-xs">Categorias</CardDescription>
              <CardTitle className="text-xl">{stats.categories}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters & Actions */}
      {selectedSourceId && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select 
            value={selectedClass} 
            onValueChange={(v) => setSelectedClass(v as ContentClass | 'all')}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Classes</SelectItem>
              <SelectItem value="tv">TV ao Vivo</SelectItem>
              <SelectItem value="movies">Filmes</SelectItem>
              <SelectItem value="series">Séries</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={selectedCategory || 'all'} 
            onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {allCategories.slice(0, 50).map(cat => (
                <SelectItem key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEntries.size > 0 && (
            <div className="flex gap-2">
              <Badge variant="secondary">
                {selectedEntries.size} selecionados
              </Badge>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setMoveDialogOpen(true)}
              >
                <FolderInput className="w-4 h-4 mr-1" />
                Mover
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setSelectedEntries(new Set())}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedSourceId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione uma fonte M3U para começar a editar
          </CardContent>
        </Card>
      ) : groupedData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma entrada encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedData.map(classGroup => {
            const Icon = CLASS_ICONS[classGroup.class];
            
            return (
              <Card key={classGroup.class}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <CardTitle className="text-lg">{classGroup.label}</CardTitle>
                    <Badge variant="outline">{classGroup.totalEntries.toLocaleString()}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {classGroup.categories.map(category => {
                        const isExpanded = expandedCategories.has(category.name);
                        const allSelected = category.entries.every(e => selectedEntries.has(e.id));
                        const someSelected = category.entries.some(e => selectedEntries.has(e.id));
                        
                        return (
                          <Collapsible
                            key={category.name}
                            open={isExpanded}
                            onOpenChange={() => toggleCategory(category.name)}
                          >
                            <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={() => selectAllInCategory(category)}
                                className={someSelected && !allSelected ? 'opacity-50' : ''}
                              />
                              
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              
                              <span className="font-medium flex-1 truncate">
                                {category.displayName}
                              </span>
                              
                              <Badge variant="secondary" className="text-xs">
                                {category.entries.length}
                              </Badge>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingCategory(category.name);
                                    setNewCategoryName(category.name);
                                  }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Renomear Categoria
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => selectAllInCategory(category)}>
                                    <Check className="w-4 h-4 mr-2" />
                                    Selecionar Todos
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                                      Mover para Classe
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {(['tv', 'movies', 'series', 'other'] as ContentClass[])
                                        .filter(cls => cls !== category.contentClass)
                                        .map(cls => {
                                          const ClsIcon = CLASS_ICONS[cls];
                                          return (
                                            <DropdownMenuItem 
                                              key={cls}
                                              onClick={() => moveCategoryToClass(category.name, cls)}
                                            >
                                              <ClsIcon className="w-4 h-4 mr-2" />
                                              {CLASS_LABELS[cls]}
                                            </DropdownMenuItem>
                                          );
                                        })}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            <CollapsibleContent>
                              <div className="ml-8 mt-1 space-y-1 max-h-[300px] overflow-y-auto">
                                {category.entries.slice(0, 100).map(entry => (
                                  <div 
                                    key={entry.id}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 text-sm group"
                                  >
                                    <Checkbox
                                      checked={selectedEntries.has(entry.id)}
                                      onCheckedChange={() => toggleEntrySelection(entry.id)}
                                    />
                                    
                                    {entry.tvg_logo && (
                                      <img 
                                        src={entry.tvg_logo} 
                                        alt=""
                                        className="w-6 h-6 rounded object-cover"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                      />
                                    )}
                                    
                                    <span className="flex-1 truncate">{entry.title}</span>
                                    
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setEditingEntry(entry)}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => deleteEntry(entry.id)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {category.entries.length > 100 && (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    +{category.entries.length - 100} itens (use busca para filtrar)
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Entrada</DialogTitle>
            <DialogDescription>
              Modifique as informações desta entrada
            </DialogDescription>
          </DialogHeader>
          
          {editingEntry && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={editingEntry.title}
                  onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Categoria (group-title)</Label>
                <Input
                  value={editingEntry.group_title || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, group_title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>TVG Name</Label>
                <Input
                  value={editingEntry.tvg_name || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, tvg_name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>TVG ID</Label>
                <Input
                  value={editingEntry.tvg_id || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, tvg_id: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={editingEntry.tvg_logo || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, tvg_logo: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Stream URL (somente leitura)</Label>
                <Input
                  value={editingEntry.stream_url}
                  disabled
                  className="opacity-60"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEntry}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Categoria</DialogTitle>
            <DialogDescription>
              Todas as entradas desta categoria serão atualizadas
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Novo nome da categoria</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: SÉRIES: NETFLIX"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRenameCategory}>
              <Save className="w-4 h-4 mr-2" />
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Entries Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Entradas</DialogTitle>
            <DialogDescription>
              Mover {selectedEntries.size} entrada(s) para outra categoria
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria de destino</Label>
              <Select value={targetCategory} onValueChange={setTargetCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <p className="text-xs text-muted-foreground mt-2">
                Ou digite uma nova categoria:
              </p>
              <Input
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                placeholder="Ex: FILMES: AÇÃO"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMoveSelected} disabled={!targetCategory}>
              <FolderInput className="w-4 h-4 mr-2" />
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
