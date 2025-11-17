import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Eye, EyeOff, Star, AlertCircle, LinkIcon, ExternalLink } from 'lucide-react';
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
  plan_type?: 'teste' | 'basico' | 'premium';
  priority?: number;
}

export default function AdminM3ULists() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [lists, setLists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [listName, setListName] = useState('');
  const [listUrl, setListUrl] = useState('');
  const [planType, setPlanType] = useState<'teste' | 'basico' | 'premium'>('teste');
  const [priority, setPriority] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  // Schema de validação para URL M3U
  const m3uUrlSchema = z.object({
    name: z.string()
      .trim()
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    url: z.string()
      .trim()
      .url('URL inválida')
      .regex(/\.(m3u|m3u8)($|\?)/i, 'URL deve apontar para arquivo .m3u ou .m3u8'),
  });

  const handleUrlChange = (url: string) => {
    setListUrl(url);
    setValidationError(null);
    
    // Validar URL em tempo real
    const validation = m3uUrlSchema.safeParse({
      name: listName || 'temp',
      url: url
    });

    if (!validation.success && url.trim()) {
      const urlError = validation.error.errors.find(e => e.path.includes('url'));
      if (urlError) {
        setValidationError(urlError.message);
      }
    }
  };

  const handleSaveList = async () => {
    // Validações
    const validation = m3uUrlSchema.safeParse({
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

      // Criar registro no banco de dados com URL direta
      const { data: insertData, error: insertError } = await supabase
        .from('m3u_lists')
        .insert([
          {
            name: listName.trim(),
            file_url: listUrl.trim(),
            status: 'active',
            plan_type: planType,
            priority: priority,
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar registro:', insertError);
        throw new Error(`Falha ao registrar lista: ${insertError.message}`);
      }

      toast.success('Lista M3U criada com sucesso!', {
        description: `${listName} foi adicionada ao sistema`
      });
      
      setIsDialogOpen(false);
      setListName('');
      setListUrl('');
      setPlanType('teste');
      setPriority(0);
      setValidationError(null);
      loadLists();
    } catch (error: any) {
      console.error('Error creating M3U list:', error);
      
      let errorMessage = 'Erro desconhecido ao criar lista';
      
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

      toast.error('Erro ao criar lista M3U', {
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

  const getPlanTypeBadge = (planType?: string) => {
    switch (planType) {
      case 'teste':
        return <Badge variant="secondary">Teste</Badge>;
      case 'basico':
        return <Badge variant="outline">Básico</Badge>;
      case 'premium':
        return <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">Premium</Badge>;
      default:
        return <Badge variant="secondary">Teste</Badge>;
    }
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
          <Button onClick={() => setIsDialogOpen(true)}>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Lista M3U</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo M3U ou M3U8 com a lista de canais
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="listName">Nome da Lista</Label>
              <Input
                id="listName"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Ex: Canais Premium HD"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="planType">Tipo de Plano</Label>
              <select
                id="planType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={planType}
                onChange={(e) => setPlanType(e.target.value as any)}
              >
                <option value="teste">Teste (Trial/Gratuito)</option>
                <option value="basico">Básico (Mensal/Trimestral)</option>
                <option value="premium">Premium (Semestral/Anual)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Clientes receberão esta lista automaticamente baseado no plano contratado
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Prioridade (0-100)</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Maior prioridade = preferida quando múltiplas listas estão disponíveis para o mesmo plano
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="file">Arquivo M3U</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".m3u,.m3u8"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setValidationError(null);
                      const input = document.getElementById('file') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              
              {selectedFile && !validationError && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3 rounded-lg">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    ✓ <strong>{selectedFile.name}</strong>
                    <br />
                    Tamanho: {formatFileSize(selectedFile.size)} | Tipo: {selectedFile.type || 'M3U'}
                  </p>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: .m3u, .m3u8 | Tamanho máximo: 50MB
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Requisitos do arquivo M3U:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Deve começar com #EXTM3U na primeira linha</li>
                  <li>Extensão .m3u ou .m3u8</li>
                  <li>Tamanho máximo de 50MB</li>
                  <li>URLs válidas e acessíveis dos canais</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !selectedFile || !listName || !!validationError}
            >
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Enviando...' : 'Enviar Lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
