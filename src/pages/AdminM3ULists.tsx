import { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Loader2, FileText, Download, Eye, EyeOff, Star, AlertCircle } from 'lucide-react';
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
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [listName, setListName] = useState('');
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

  // Schema de validação para arquivos M3U
  const m3uFileSchema = z.object({
    name: z.string()
      .refine(
        (name) => /\.(m3u|m3u8)$/i.test(name),
        'Arquivo deve ter extensão .m3u ou .m3u8'
      ),
    size: z.number()
      .max(50 * 1024 * 1024, 'Arquivo não pode ser maior que 50MB')
      .min(1, 'Arquivo não pode estar vazio'),
    type: z.string()
      .refine(
        (type) => type === '' || type.includes('text') || type.includes('audio/x-mpegurl') || type.includes('application/vnd.apple.mpegurl'),
        'Tipo de arquivo não suportado'
      ),
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setValidationError(null);
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validar arquivo usando schema Zod
    const validation = m3uFileSchema.safeParse({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.success) {
      const errorMessage = validation.error.errors[0].message;
      setValidationError(errorMessage);
      toast.error('Arquivo inválido', {
        description: errorMessage
      });
      event.target.value = ''; // Limpar input
      setSelectedFile(null);
      return;
    }

    // Validação adicional: verificar se começa com #EXTM3U
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const firstLine = content.trim().split('\n')[0];
      
      if (!firstLine.startsWith('#EXTM3U')) {
        setValidationError('Arquivo M3U inválido: deve começar com #EXTM3U');
        toast.error('Formato M3U inválido', {
          description: 'O arquivo deve começar com #EXTM3U na primeira linha'
        });
        event.target.value = '';
        setSelectedFile(null);
        return;
      }

      // Arquivo válido
      setSelectedFile(file);
      setValidationError(null);
      
      if (!listName) {
        setListName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
      }

      toast.success('Arquivo validado', {
        description: `${file.name} (${formatFileSize(file.size)}) está pronto para upload`
      });
    };

    reader.onerror = () => {
      setValidationError('Erro ao ler arquivo');
      toast.error('Erro ao ler arquivo');
      event.target.value = '';
      setSelectedFile(null);
    };

    reader.readAsText(file.slice(0, 1024)); // Ler apenas os primeiros 1KB para validar
  };

  const handleUpload = async () => {
    // Validações antes do upload
    if (!selectedFile) {
      toast.error('Nenhum arquivo selecionado', {
        description: 'Por favor, selecione um arquivo M3U válido'
      });
      return;
    }

    if (!listName.trim()) {
      toast.error('Nome da lista obrigatório', {
        description: 'Por favor, forneça um nome para a lista M3U'
      });
      return;
    }

    if (listName.trim().length < 3) {
      toast.error('Nome muito curto', {
        description: 'O nome da lista deve ter pelo menos 3 caracteres'
      });
      return;
    }

    if (listName.trim().length > 100) {
      toast.error('Nome muito longo', {
        description: 'O nome da lista deve ter no máximo 100 caracteres'
      });
      return;
    }

    if (validationError) {
      toast.error('Arquivo inválido', {
        description: validationError
      });
      return;
    }

    try {
      setIsUploading(true);

      // Upload do arquivo para o storage com validação adicional
      const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      
      console.log('Iniciando upload:', {
        fileName,
        size: selectedFile.size,
        type: selectedFile.type
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('m3u-files')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload do storage:', uploadError);
        throw new Error(`Falha no upload: ${uploadError.message}`);
      }

      if (!uploadData) {
        throw new Error('Upload não retornou dados');
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('m3u-files')
        .getPublicUrl(fileName);

      if (!urlData.publicUrl) {
        throw new Error('Não foi possível obter URL pública do arquivo');
      }

      console.log('Upload concluído, criando registro no banco...');

      // Criar registro no banco de dados
      const { data: insertData, error: insertError } = await supabase
        .from('m3u_lists')
        .insert([
          {
            name: listName.trim(),
            file_url: urlData.publicUrl,
            status: 'active',
            plan_type: planType,
            priority: priority,
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar registro no banco:', insertError);
        // Tentar deletar arquivo do storage se falhar
        await supabase.storage.from('m3u-files').remove([fileName]);
        throw new Error(`Falha ao registrar lista: ${insertError.message}`);
      }

      console.log('Lista M3U criada com sucesso:', insertData);

      toast.success('Lista M3U enviada com sucesso!', {
        description: `${listName} foi adicionada ao sistema`
      });
      
      setIsDialogOpen(false);
      setSelectedFile(null);
      setListName('');
      setPlanType('teste');
      setPriority(0);
      setValidationError(null);
      loadLists();
    } catch (error: any) {
      console.error('Error uploading M3U:', error);
      
      let errorMessage = 'Erro desconhecido ao enviar lista';
      
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
      } else if (errorMessage.includes('storage')) {
        errorMessage = 'Erro no storage. Verifique as permissões do bucket m3u-files.';
      } else if (errorMessage.includes('duplicate')) {
        errorMessage = 'Já existe uma lista com este nome.';
      } else if (errorMessage.includes('network')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      }

      toast.error('Erro ao enviar lista M3U', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
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

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm('Tem certeza que deseja excluir esta lista M3U?')) return;

    try {
      // Extrair o nome do arquivo da URL
      const urlParts = fileName.split('/');
      const storageFileName = urlParts[urlParts.length - 1];

      // Excluir arquivo do storage
      const { error: storageError } = await supabase.storage
        .from('m3u-files')
        .remove([storageFileName]);

      if (storageError) console.error('Storage delete error:', storageError);

      // Excluir registro do banco
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
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
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
                          onClick={() => handleDelete(list.id, list.file_url)}
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
