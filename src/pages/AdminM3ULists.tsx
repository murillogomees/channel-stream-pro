import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Star, LinkIcon, Check, Pencil, Users, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useM3UListFavorites } from '@/hooks/useM3UListFavorites';
import { M3UClientManager } from '@/components/admin/M3UClientManager';

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_default?: boolean;
  description?: string;
  plan_type?: string[];
  usage_count?: number;
}

const PLAN_TYPES = [
  { value: 'testando', label: 'Testando' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'vip', label: 'VIP' }
];

export default function AdminM3ULists() {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useM3UListFavorites();
  
  const [lists, setLists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingList, setEditingList] = useState<M3UList | null>(null);
  const [listName, setListName] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [planTypes, setPlanTypes] = useState<string[]>(['mensal']);
  const [isActive, setIsActive] = useState(true);
  const [clientManagerOpen, setClientManagerOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedListName, setSelectedListName] = useState<string>('');

  useEffect(() => {
    loadLists();

    // Subscrição em tempo real para mudanças nas atribuições
    const channel = supabase
      .channel('client_m3u_lists_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
            schema: 'public',
            table: 'client_m3u_lists'
          },
          () => {
            loadLists();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
  }, []);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      
      // Buscar todas as listas
      const { data: lists, error: listsError } = await supabase
        .from('m3u_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;

      // Buscar vínculos ativos
      const { data: assignments, error: assignmentsError } = await supabase
        .from('client_m3u_lists')
        .select('m3u_list_id')
        .eq('is_active', true);

      if (assignmentsError) throw assignmentsError;

      // Contar vínculos por lista
      const usageMap = new Map<string, number>();
      assignments?.forEach(assignment => {
        const current = usageMap.get(assignment.m3u_list_id) || 0;
        usageMap.set(assignment.m3u_list_id, current + 1);
      });

      // Mapear listas com contagem correta
      const listsWithUsage = (lists || []).map(list => ({
        ...list,
        usage_count: usageMap.get(list.id) || 0
      }));

      setLists(listsWithUsage as M3UList[]);
    } catch (error: any) {
      console.error('Error loading M3U lists:', error);
      toast.error('Erro ao carregar listas M3U', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (list?: M3UList) => {
    if (list) {
      setEditingList(list);
      setListName(list.name);
      setListUrl(list.file_url);
      setListDescription(list.description || '');
      setPlanTypes(list.plan_type || ['mensal']);
      setIsActive(list.status === 'active');
    } else {
      setEditingList(null);
      setListName('');
      setListUrl('');
      setListDescription('');
      setPlanTypes(['mensal']);
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingList(null);
    setListName('');
    setListUrl('');
    setListDescription('');
    setPlanTypes(['mensal']);
    setIsActive(true);
  };

  const handleSaveList = async () => {
    if (!listName.trim() || !listUrl.trim()) {
      toast.error('Preencha nome e URL');
      return;
    }

    if (planTypes.length === 0) {
      toast.error('Selecione pelo menos um tipo de plano');
      return;
    }

    try {
      setIsSaving(true);

      if (editingList) {
        const { error } = await supabase
          .from('m3u_lists')
          .update({
            name: listName.trim(),
            file_url: listUrl.trim(),
            description: listDescription.trim() || null,
            plan_type: planTypes,
            status: isActive ? 'active' : 'inactive',
          })
          .eq('id', editingList.id);

        if (error) throw error;
        toast.success('Lista M3U atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('m3u_lists')
          .insert([{
            name: listName.trim(),
            file_url: listUrl.trim(),
            description: listDescription.trim() || null,
            plan_type: planTypes,
            status: isActive ? 'active' : 'inactive',
          }]);

        if (error) throw error;
        toast.success('Lista M3U criada com sucesso!');
      }
      
      handleCloseDialog();
      await loadLists();
    } catch (error: any) {
      console.error('Error saving list:', error);
      toast.error('Erro ao salvar lista', {
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('Deseja realmente deletar esta lista?')) return;

    try {
      const { error } = await supabase
        .from('m3u_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Lista deletada com sucesso!');
      await loadLists();
    } catch (error: any) {
      console.error('Error deleting list:', error);
      toast.error('Erro ao deletar lista', {
        description: error.message
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await supabase.from('m3u_lists').update({ is_default: false }).neq('id', id);
      const { error } = await supabase.from('m3u_lists').update({ is_default: true }).eq('id', id);
      
      if (error) throw error;
      toast.success('Lista definida como padrão');
      await loadLists();
    } catch (error: any) {
      toast.error('Erro ao definir lista padrão', { description: error.message });
    }
  };

  const handleTogglePlanType = (type: string) => {
    setPlanTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleOpenClientManager = (list: M3UList) => {
    setSelectedListId(list.id);
    setSelectedListName(list.name);
    setClientManagerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header com botão */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Listas M3U</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Gerencie as listas de canais IPTV</p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm" className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Nova Lista
        </Button>
      </div>

      {/* Stats Grid - Responsivo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{lists.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Ativas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {lists.filter(l => l.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium">Em Uso</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {lists.reduce((sum, l) => sum + (l.usage_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Desktop */}
      <Card className="hidden md:block">
        <CardHeader className="p-4">
          <CardTitle className="text-base">Listas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden lg:table-cell">Planos</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma lista cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  lists.map((list) => (
                    <TableRow key={list.id}>
                      <TableCell className="p-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleFavorite(list.id)}>
                          <Star className={`h-4 w-4 ${isFavorite(list.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate max-w-[150px]">{list.name}</span>
                          {list.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(list.plan_type || []).slice(0, 3).map(type => (
                            <Badge key={type} variant="outline" className="text-xs">{PLAN_TYPES.find(p => p.value === type)?.label || type}</Badge>
                          ))}
                          {(list.plan_type || []).length > 3 && <Badge variant="outline" className="text-xs">+{(list.plan_type || []).length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{list.usage_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={list.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {list.status === 'active' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenClientManager(list)}><Users className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenDialog(list)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {!list.is_default && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSetDefault(list.id)}><Check className="h-3.5 w-3.5" /></Button>}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(list.file_url); toast.success('URL copiada!'); }}><LinkIcon className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteList(list.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cards Mobile */}
      <div className="md:hidden space-y-3">
        {lists.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Nenhuma lista cadastrada
            </CardContent>
          </Card>
        ) : (
          lists.map((list) => (
            <Card key={list.id}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => toggleFavorite(list.id)}>
                    <Star className={`h-4 w-4 ${isFavorite(list.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{list.name}</span>
                      {list.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                      <Badge variant={list.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {list.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-xs">{list.usage_count || 0} clientes</Badge>
                      {(list.plan_type || []).slice(0, 2).map(type => (
                        <Badge key={type} variant="outline" className="text-xs">{PLAN_TYPES.find(p => p.value === type)?.label || type}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenClientManager(list)}><Users className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(list)}><Pencil className="h-4 w-4" /></Button>
                  {!list.is_default && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(list.id)}><Check className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(list.file_url); toast.success('URL copiada!'); }}><LinkIcon className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteList(list.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingList ? 'Editar Lista M3U' : 'Nova Lista M3U'}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes da lista M3U e os tipos de plano que podem usá-la
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Lista *</Label>
              <Input
                id="name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Ex: Lista Premium HD 4K"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL do Arquivo M3U *</Label>
              <Input
                id="url"
                value={listUrl}
                onChange={(e) => setListUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">
                Descrição
                <span className="text-xs text-muted-foreground ml-2">
                  ({listDescription.length}/500)
                </span>
              </Label>
              <Textarea
                id="description"
                value={listDescription}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setListDescription(e.target.value);
                  }
                }}
                placeholder="Descreva as características desta playlist (qualidade, canais, região, idiomas, etc.)"
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="grid gap-3">
              <Label>Tipos de Plano que Podem Usar Esta Lista *</Label>
              <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
                {PLAN_TYPES.map(type => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.value}
                      checked={planTypes.includes(type.value)}
                      onCheckedChange={() => handleTogglePlanType(type.value)}
                    />
                    <Label 
                      htmlFor={type.value} 
                      className="cursor-pointer font-normal"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
              {planTypes.length === 0 && (
                <p className="text-xs text-destructive">
                  Selecione pelo menos um tipo de plano
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="status"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="status">Lista ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCloseDialog} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveList}
              disabled={!listName.trim() || !listUrl.trim() || planTypes.length === 0 || isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <M3UClientManager
        listId={selectedListId}
        listName={selectedListName}
        open={clientManagerOpen}
        onOpenChange={setClientManagerOpen}
        onUpdate={loadLists}
      />
    </div>
  );
}
