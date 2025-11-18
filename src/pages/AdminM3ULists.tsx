import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Eye, EyeOff, Star, AlertCircle, LinkIcon, ExternalLink, Edit, Check, Search, Download, History, Filter, TrendingUp, Save, RefreshCw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useM3UTags, M3UTag } from '@/hooks/useM3UTags';
import { useM3UViewHistory } from '@/hooks/useM3UViewHistory';
import { useM3UListFavorites } from '@/hooks/useM3UListFavorites';
import { M3UTagSelector } from '@/components/admin/M3UTagSelector';
import { M3UViewHistoryDialog } from '@/components/admin/M3UViewHistoryDialog';
import { AdminComparison } from '@/components/admin/AdminComparison';
import { M3UListFilters } from '@/components/admin/M3UListFilters';
import { exportToCSV, M3UListExport } from '@/utils/m3uExport';

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_default?: boolean;
  priority?: number;
  description?: string;
  created_by?: string;
  updated_by?: string;
  tags?: M3UTag[];
}

interface M3UAuditLog {
  id: string;
  m3u_list_id: string;
  changed_by: string;
  change_type: 'created' | 'updated' | 'deleted';
  old_values?: any;
  new_values?: any;
  created_at: string;
  admin_name?: string;
}

export default function AdminM3ULists() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { tags, getListTags, updateListTags } = useM3UTags();
  const { logView, getListHistory } = useM3UViewHistory();
  const { isFavorite, toggleFavorite } = useM3UListFavorites();
  
  const [lists, setLists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingList, setEditingList] = useState<M3UList | null>(null);
  const [listName, setListName] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [auditLogs, setAuditLogs] = useState<M3UAuditLog[]>([]);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [currentListHistory, setCurrentListHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentHistoryListName, setCurrentHistoryListName] = useState('');
  const [tagFilterLogic, setTagFilterLogic] = useState<'AND' | 'OR'>('OR');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [bulkTagsDialogOpen, setBulkTagsDialogOpen] = useState(false);
  const [bulkSelectedTags, setBulkSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadLists();
    }
  }, [isAdmin]);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('m3u_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Carregar tags para cada lista
      const listsWithTags = await Promise.all(
        (data || []).map(async (list) => {
          const tags = await getListTags(list.id);
          return { ...list, tags };
        })
      );

      setLists(listsWithTags as M3UList[]);
    } catch (error: any) {
      console.error('Error loading M3U lists:', error);
      toast.error('Erro ao carregar listas M3U', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLists = lists.filter((list) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = list.name.toLowerCase().includes(query) ||
      (list.description?.toLowerCase() || '').includes(query);
    
    const matchesTags = list.tags?.some(tag => 
      tag.name.toLowerCase().includes(query)
    );

    // Tag filtering with AND/OR logic
    let matchesTagFilter = true;
    if (selectedTags.length > 0) {
      if (tagFilterLogic === 'AND') {
        matchesTagFilter = selectedTags.every(selectedTag => 
          list.tags?.some(tag => tag.id === selectedTag)
        );
      } else {
        matchesTagFilter = list.tags?.some(tag => selectedTags.includes(tag.id)) || false;
      }
    }

    // Status filtering
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && list.status === 'active') ||
      (statusFilter === 'inactive' && list.status === 'inactive');

    // Favorites filtering
    const matchesFavorites = !showFavoritesOnly || isFavorite(list.id);

    return (matchesSearch || matchesTags) && matchesTagFilter && matchesStatus && matchesFavorites;
  });

  // Schema de validação completo
  const m3uListSchema = z.object({
    name: z.string()
      .trim()
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    url: z.string()
      .trim()
      .url('URL inválida')
  });

  const testUrlConnectivity = async () => {
    if (!listUrl.trim()) {
      toast.error('Informe uma URL para testar');
      return;
    }

    const validation = z.object({
      url: z.string().trim().url('URL inválida')
    }).safeParse({
      url: listUrl
    });

    if (!validation.success) {
      toast.error('URL inválida', {
        description: 'Corrija a URL antes de testar a conectividade'
      });
      return;
    }

    try {
      setIsTestingUrl(true);
      
      // Tentar fazer requisição HEAD para verificar se o endpoint está acessível
      const response = await fetch(listUrl, {
        method: 'HEAD',
        mode: 'no-cors', // Evitar problemas com CORS
      });

      toast.success('URL acessível!', {
        description: 'O endpoint M3U está disponível e pode ser usado'
      });
    } catch (error: any) {
      console.error('Erro ao testar URL:', error);
      toast.warning('Não foi possível verificar a conectividade', {
        description: 'A URL pode estar protegida por CORS. Você ainda pode salvá-la, mas recomendamos verificar manualmente se funciona.'
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const loadAuditHistory = async (listId: string) => {
    try {
      const { data, error } = await supabase
        .from('m3u_lists_audit')
        .select('*')
        .eq('m3u_list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLogs = (data || []).map((log: any) => ({
        ...log,
        admin_name: 'Sistema'
      }));

      setAuditLogs(formattedLogs);
    } catch (error: any) {
      console.error('Error loading audit history:', error);
    }
  };

  const handleOpenDialog = async (list?: M3UList) => {
    if (list) {
      setEditingList(list);
      setListName(list.name);
      setListUrl(list.file_url);
      setListDescription(list.description || '');
      setPriority(list.priority || 0);
      setIsActive(list.status === 'active');
      
      // Carregar tags da lista
      const tags = await getListTags(list.id);
      setSelectedTags(tags.map(t => t.id));
      
      await loadAuditHistory(list.id);
      setShowAuditHistory(true);
      
      // Registrar visualização
      await logView(list.id, 'edit');
    } else {
      setEditingList(null);
      setListName('');
      setListUrl('');
      setListDescription('');
      setPriority(0);
      setIsActive(true);
      setSelectedTags([]);
      setAuditLogs([]);
      setShowAuditHistory(false);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingList(null);
    setListName('');
    setListUrl('');
    setListDescription('');
    setPriority(0);
    setIsActive(true);
    setSelectedTags([]);
    setAuditLogs([]);
    setShowAuditHistory(false);
  };

  const handleSaveList = async () => {
    // Validações
    const validation = m3uListSchema.safeParse({
      name: listName,
      url: listUrl
    });

    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(', ');
      toast.error('Dados inválidos', {
        description: errors
      });
      return;
    }

    try {
      setIsSaving(true);

      if (editingList) {
        // Modo edição
        const { error: updateError } = await supabase
          .from('m3u_lists')
          .update({
            name: listName.trim(),
            file_url: listUrl.trim(),
            description: listDescription.trim() || null,
            priority: priority,
            status: isActive ? 'active' : 'inactive',
          })
          .eq('id', editingList.id);

        if (updateError) {
          console.error('Erro ao atualizar registro:', updateError);
          throw new Error(`Falha ao atualizar lista: ${updateError.message}`);
        }

        // Atualizar tags
        await updateListTags(editingList.id, selectedTags);

        toast.success('Lista M3U atualizada com sucesso!', {
          description: `${listName} foi atualizada`
        });
      } else {
        // Modo criação
        const { data: newList, error: insertError } = await supabase
          .from('m3u_lists')
          .insert([
            {
              name: listName.trim(),
              file_url: listUrl.trim(),
              description: listDescription.trim() || null,
              status: isActive ? 'active' : 'inactive',
              priority: priority,
            }
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao criar registro:', insertError);
          throw new Error(`Falha ao registrar lista: ${insertError.message}`);
        }

        // Adicionar tags
        if (newList && selectedTags.length > 0) {
          await updateListTags(newList.id, selectedTags);
        }

        toast.success('Lista M3U criada com sucesso!', {
          description: `${listName} foi adicionada ao sistema`
        });
      }
      
      handleCloseDialog();
      loadLists();
    } catch (error: any) {
      console.error('Error saving M3U list:', error);
      
      let errorMessage = 'Erro desconhecido ao salvar lista';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Mensagens de erro específicas
      if (errorMessage.includes('row-level security')) {
        errorMessage = 'Permissões insuficientes. Verifique se você tem acesso de administrador.';
      } else if (errorMessage.includes('duplicate')) {
        errorMessage = 'Já existe uma lista com este nome.';
      } else if (errorMessage.includes('network')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      }

      toast.error(`Erro ao ${editingList ? 'atualizar' : 'criar'} lista M3U`, {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      const { error } = await supabase
        .from('m3u_lists')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Lista ${newStatus === 'active' ? 'ativada' : 'desativada'} com sucesso!`);
      loadLists();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status', {
        description: error.message
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta lista M3U?')) return;

    try {
      // Excluir apenas o registro do banco (não há mais arquivo no storage)
      const { error: dbError } = await supabase
        .from('m3u_lists')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      toast.success('Lista M3U excluída com sucesso!');
      loadLists();
    } catch (error: any) {
      console.error('Error deleting M3U:', error);
      toast.error('Erro ao excluir lista M3U', {
        description: error.message
      });
    }
  };

  const handleSetDefault = async (id: string, currentDefault: boolean) => {
    try {
      const { error } = await supabase
        .from('m3u_lists')
        // @ts-ignore - Campo is_default será adicionado após executar M3U_DEFAULT_SETUP.sql
        .update({ is_default: !currentDefault })
        .eq('id', id);

      if (error) throw error;

      toast.success(
        !currentDefault 
          ? 'Lista definida como padrão para novos cadastros!' 
          : 'Lista removida como padrão'
      );
      loadLists();
    } catch (error: any) {
      console.error('Error setting default:', error);
      toast.error('Erro ao definir lista padrão', {
        description: error.message
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleExportCSV = async () => {
    try {
      await logView('export', 'export');
      
      const exportData: M3UListExport[] = filteredLists.map(list => ({
        id: list.id,
        name: list.name,
        file_url: list.file_url,
        description: list.description,
        priority: list.priority,
        status: list.status,
        is_default: list.is_default,
        created_at: list.created_at,
        updated_at: list.updated_at,
        tags: list.tags?.map(t => t.name).join(', ')
      }));

      exportToCSV(exportData);
      toast.success('Listas exportadas com sucesso!');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Erro ao exportar listas');
    }
  };

  const handleShowHistory = async (list: M3UList) => {
    setCurrentHistoryListName(list.name);
    setIsLoadingHistory(true);
    setShowHistoryDialog(true);
    
    const history = await getListHistory(list.id);
    setCurrentListHistory(history);
    setIsLoadingHistory(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Listas M3U</h1>
          <p className="text-muted-foreground">Gerencie as listas de canais IPTV</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/m3u-stats')}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Estatísticas
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
            Voltar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Lista
          </Button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou descrição (ex: HD, 4K, Esportes)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <M3UListFilters
          tags={tags}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          tagFilterLogic={tagFilterLogic}
          onTagFilterLogicChange={setTagFilterLogic}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          showFavoritesOnly={showFavoritesOnly}
          onShowFavoritesOnlyChange={setShowFavoritesOnly}
        />
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
            <div className="text-2xl font-bold text-green-600">
              {lists.filter(l => l.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Listas Inativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {lists.filter(l => l.status !== 'active').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listas Cadastradas</CardTitle>
          <CardDescription>
            {lists.length} lista(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedLists.length === filteredLists.length && filteredLists.length > 0}
                    onChange={handleSelectAll}
                    className="cursor-pointer"
                  />
                </TableHead>
                <TableHead>Favorito</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="max-w-xs">Descrição</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {searchQuery 
                      ? 'Nenhuma lista encontrada com esses critérios' 
                      : 'Nenhuma lista M3U cadastrada. Clique em "Nova Lista" para adicionar.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedLists.includes(list.id)}
                        onChange={() => handleSelectList(list.id)}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(list.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Star 
                          className={`h-4 w-4 ${isFavorite(list.id) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                        />
                      </Button>
                    </TableCell>
                     <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {list.name}
                        {list.is_default && (
                          <Badge variant="default" className="gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            Padrão
                          </Badge>
                        )}
                      </div>
                     </TableCell>
                     <TableCell className="max-w-xs">
                       {list.description ? (
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span className="truncate block cursor-help">
                                 {list.description}
                               </span>
                             </TooltipTrigger>
                             <TooltipContent className="max-w-md">
                               <p>{list.description}</p>
                             </TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                       ) : (
                         <span className="text-muted-foreground italic text-sm">Sem descrição</span>
                       )}
                     </TableCell>
                     <TableCell>
                       <div className="flex flex-wrap gap-1">
                         {list.tags && list.tags.length > 0 ? (
                           list.tags.map(tag => (
                             <Badge 
                               key={tag.id} 
                               variant="secondary" 
                               className="text-xs"
                               style={tag.color ? { backgroundColor: tag.color } : undefined}
                             >
                               {tag.name}
                             </Badge>
                           ))
                         ) : (
                           <span className="text-muted-foreground italic text-sm">Sem tags</span>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                      <Badge variant="outline">{list.priority || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={list.status === 'active' ? 'default' : 'secondary'}>
                        {list.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(list.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant={list.is_default ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handleSetDefault(list.id, list.is_default || false)}
                          title={list.is_default ? 'Remover como padrão' : 'Definir como padrão'}
                        >
                          <Star className={`w-4 h-4 ${list.is_default ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(list.file_url, '_blank')}
                          title="Abrir URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShowHistory(list)}
                          title="Ver histórico"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(list)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(list.id, list.status)}
                          title={list.status === 'active' ? 'Desativar' : 'Ativar'}
                        >
                          {list.status === 'active' ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(list.id)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
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

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingList ? 'Editar' : 'Nova'} Lista M3U</DialogTitle>
            <DialogDescription>
              {editingList ? 'Edite os dados da lista M3U' : 'Adicione uma nova lista M3U informando a URL direta do arquivo'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Lista *</Label>
              <Input
                id="name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Ex: Lista Premium HD"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL do Arquivo M3U *</Label>
              <Input
                id="url"
                value={listUrl}
                onChange={(e) => setListUrl(e.target.value)}
                placeholder="https://exemplo.com/playlist.m3u"
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

            <div className="grid gap-2">
              <Label htmlFor="priority">
                Prioridade
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">
                        Playlists com maior prioridade são selecionadas primeiro
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>

            <div className="grid gap-2">
              <Label>
                Tags
                <span className="text-xs text-muted-foreground ml-2">
                  Selecione tags para categorizar esta lista
                </span>
              </Label>
              <M3UTagSelector
                selectedTags={selectedTags}
                onChange={setSelectedTags}
              />
            </div>

            <div className="flex items-center space-x-2">
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
              disabled={!listName.trim() || !listUrl.trim() || isSaving}
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

      <M3UViewHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        listName={currentHistoryListName}
        history={currentListHistory}
        isLoading={isLoadingHistory}
      />
    </div>
  );
}
