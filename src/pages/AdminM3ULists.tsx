import { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Loader2, FileText, Download, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useLocalAuth } from '@/hooks/useLocalAuth';

interface M3UList {
  id: string;
  name: string;
  filename: string;
  file_url: string;
  file_size: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AdminM3ULists() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useLocalAuth();
  const [lists, setLists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [listName, setListName] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadLists();
    }
  }, [isAuthenticated]);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('m3u_lists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLists(data || []);
    } catch (error: any) {
      console.error('Error loading M3U lists:', error);
      toast.error('Erro ao carregar listas M3U', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.m3u') && !file.name.endsWith('.m3u8')) {
        toast.error('Formato inválido', {
          description: 'Por favor, selecione um arquivo .m3u ou .m3u8'
        });
        return;
      }
      setSelectedFile(file);
      if (!listName) {
        setListName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !listName) {
      toast.error('Dados incompletos', {
        description: 'Selecione um arquivo e forneça um nome para a lista'
      });
      return;
    }

    try {
      setIsUploading(true);

      // Upload do arquivo para o storage
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('m3u-files')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('m3u-files')
        .getPublicUrl(fileName);

      // Criar registro no banco de dados
      const { error: insertError } = await supabase
        .from('m3u_lists')
        .insert([
          {
            name: listName,
            filename: selectedFile.name,
            file_url: urlData.publicUrl,
            file_size: selectedFile.size,
            status: 'active'
          }
        ]);

      if (insertError) throw insertError;

      toast.success('Lista M3U enviada com sucesso!');
      setIsDialogOpen(false);
      setSelectedFile(null);
      setListName('');
      loadLists();
    } catch (error: any) {
      console.error('Error uploading M3U:', error);
      toast.error('Erro ao enviar lista M3U', {
        description: error.message
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
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
                <TableHead>Arquivo</TableHead>
                <TableHead>Tamanho</TableHead>
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
                    <TableCell className="font-medium">{list.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{list.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(list.file_size)}</TableCell>
                    <TableCell>
                      <Badge variant={list.status === 'active' ? 'default' : 'secondary'}>
                        {list.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(list.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                    onClick={() => setSelectedFile(null)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  Arquivo selecionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                💡 <strong>Dica:</strong> Certifique-se de que o arquivo M3U está no formato correto e contém URLs válidas para os canais.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !selectedFile || !listName}
            >
              {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Upload className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
