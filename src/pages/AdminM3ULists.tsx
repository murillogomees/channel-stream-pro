import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Star, LinkIcon, Check, RefreshCw, Pencil, Save, Users } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useM3UListFavorites } from '@/hooks/useM3UListFavorites';
import { PageHeader } from '@/components/admin/PageHeader';
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
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
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
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
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
    }
  }, [isAdmin]);

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

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso negado</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <PageHeader title="Listas M3U" description="Gerencie as listas de canais IPTV" />
      
      <div className="flex justify-end gap-2 mb-6">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Lista
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Listas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lists.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Listas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.filter(l => l.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total em Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lists.reduce((sum, l) => sum + (l.usage_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listas M3U Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipos de Plano</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(list.id)}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            isFavorite(list.id)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{list.name}</span>
                        {list.is_default && (
                          <Badge variant="secondary">Padrão</Badge>
                        )}
                      </div>
                      {list.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {list.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(list.plan_type || []).map(type => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {PLAN_TYPES.find(p => p.value === type)?.label || type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{list.usage_count || 0} clientes</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={list.status === 'active' ? 'default' : 'secondary'}>
                        {list.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenClientManager(list)}
                          title="Gerenciar clientes"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(list)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!list.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSetDefault(list.id)}
                            title="Definir como padrão"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(list.file_url);
                            toast.success('URL copiada!');
                          }}
                          title="Copiar URL"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteList(list.id)}
                          title="Deletar"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
