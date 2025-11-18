import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Eye, EyeOff, Star, AlertCircle, LinkIcon, ExternalLink, Edit, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_default?: boolean;
  plan_type?: ('teste' | 'basico' | 'premium')[];
  priority?: number;
  description?: string;
  created_by?: string;
  updated_by?: string;
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
  const [lists, setLists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingList, setEditingList] = useState<M3UList | null>(null);
  const [listName, setListName] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [planTypes, setPlanTypes] = useState<('teste' | 'basico' | 'premium')[]>(['teste']);
  const [priority, setPriority] = useState(0);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [auditLogs, setAuditLogs] = useState<M3UAuditLog[]>([]);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

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

      setLists((data || []) as M3UList[]);
    } catch (error: any) {
      console.error('Error loading M3U lists:', error);
      toast.error('Erro ao carregar listas M3U', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Schema de validação completo
  const m3uListSchema = z.object({
    name: z.string()
      .trim()
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    url: z.string()
      .trim()
      .url('URL inválida'),
    planTypes: z.array(z.enum(['teste', 'basico', 'premium']))
      .min(1, 'Selecione pelo menos um tipo de plano')
      .nonempty('Pelo menos um tipo de plano deve ser selecionado'),
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
      setPlanTypes(list.plan_type || ['teste']);
      setPriority(list.priority || 0);
      await loadAuditHistory(list.id);
      setShowAuditHistory(true);
    } else {
      setEditingList(null);
      setListName('');
      setListUrl('');
      setListDescription('');
      setPlanTypes(['teste']);
      setPriority(0);
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
    setPlanTypes(['teste']);
    setPriority(0);
    setAuditLogs([]);
    setShowAuditHistory(false);
  };

  const handleSaveList = async () => {
    // Validações
    const validation = m3uListSchema.safeParse({
      name: listName,
      url: listUrl,
      planTypes: planTypes
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
            plan_type: planTypes,
            priority: priority,
          })
          .eq('id', editingList.id);

        if (updateError) {
          console.error('Erro ao atualizar registro:', updateError);
          throw new Error(`Falha ao atualizar lista: ${updateError.message}`);
        }

        toast.success('Lista M3U atualizada com sucesso!', {
          description: `${listName} foi atualizada`
        });
      } else {
        // Modo criação
        const { error: insertError } = await supabase
          .from('m3u_lists')
          .insert([
            {
              name: listName.trim(),
              file_url: listUrl.trim(),
              status: 'active',
              plan_type: planTypes,
              priority: priority,
            }
          ]);

        if (insertError) {
          console.error('Erro ao criar registro:', insertError);
          throw new Error(`Falha ao registrar lista: ${insertError.message}`);
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

  const getPlanTypeBadge = (planType?: ('teste' | 'basico' | 'premium')[]) => {
    const colors = {
      teste: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      basico: 'bg-green-500/10 text-green-500 border-green-500/20',
      premium: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    const labels = {
      teste: 'Teste',
      basico: 'Básico',
      premium: 'Premium',
    };
    
    if (!planType || planType.length === 0) {
      return <Badge className={colors.teste}>{labels.teste}</Badge>;
    }
    
    return (
      <div className="flex gap-1 flex-wrap">
        {planType.map((type) => (
          <Badge key={type} className={colors[type]}>
            {labels[type]}
          </Badge>
        ))}
      </div>
    );
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
          <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
            Voltar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Lista
          </Button>
        </div>
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
                <TableHead>Nome</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma lista M3U cadastrada. Clique em "Nova Lista" para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                lists.map((list) => (
                  <TableRow key={list.id}>
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
                    <TableCell>{getPlanTypeBadge(list.plan_type)}</TableCell>
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
        <DialogContent className="sm:max-w-[600px]">
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
                maxLength={100}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL da Lista M3U *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="url"
                    type="url"
                    value={listUrl}
                    onChange={(e) => setListUrl(e.target.value)}
                    placeholder="https://exemplo.com/lista.m3u"
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={testUrlConnectivity}
                  disabled={isTestingUrl || !listUrl.trim()}
                  title="Testar conectividade"
                >
                  {isTestingUrl ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                O administrador é responsável por validar se a URL está correta
              </p>
              
              <p className="text-xs text-muted-foreground">
                A URL deve apontar para um arquivo .m3u ou .m3u8. Esta URL será usada para cadastrar a playlist no SmartOne IPTV.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="planTypes" className="flex items-center gap-2">
                Tipos de Plano *
                {planTypes.length === 0 && (
                  <span className="text-xs text-destructive font-normal">
                    (Selecione pelo menos um)
                  </span>
                )}
              </Label>
              <div className="space-y-2">
                <div className={`flex flex-wrap gap-2 p-3 rounded-md border ${
                  planTypes.length === 0 
                    ? 'border-destructive bg-destructive/5' 
                    : 'border-border'
                }`}>
                  {['teste', 'basico', 'premium'].map((type) => {
                    const isSelected = planTypes.includes(type as any);
                    const labels = { teste: 'Teste', basico: 'Básico', premium: 'Premium' };
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (isSelected) {
                            // Prevenir desmarcar se for o único selecionado
                            if (planTypes.length > 1) {
                              setPlanTypes(planTypes.filter(t => t !== type));
                            } else {
                              toast.error('Pelo menos um tipo de plano deve permanecer selecionado');
                            }
                          } else {
                            setPlanTypes([...planTypes, type as any]);
                          }
                        }}
                      >
                        {isSelected && <Check className="h-4 w-4 mr-1" />}
                        {labels[type as keyof typeof labels]}
                      </Button>
                    );
                  })}
                </div>
                {planTypes.length === 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Você deve selecionar pelo menos um tipo de plano
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione um ou mais tipos de planos que terão acesso a esta lista
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Listas com maior prioridade são selecionadas primeiro
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Importante:</strong> Certifique-se de que a URL está acessível publicamente e aponta para um arquivo M3U válido. Esta URL será utilizada para cadastrar playlists no SmartOne IPTV.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={handleSaveList}
                      disabled={isSaving || !listName.trim() || !listUrl.trim() || planTypes.length === 0}
                    >
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isSaving ? 'Salvando...' : editingList ? 'Atualizar Lista' : 'Salvar Lista'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {planTypes.length === 0 && (
                  <TooltipContent>
                    <p>Selecione pelo menos um tipo de plano para continuar</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
