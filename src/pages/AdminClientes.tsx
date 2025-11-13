import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { useClientes } from '@/hooks/useClientes';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, ArrowLeft, MessageSquare, Clock, Paperclip, X, FileIcon } from 'lucide-react';
import { Cliente } from '@/types/cliente';
import { getDaysUntilDue } from '@/services/notificationScheduler';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { LOCAL_TEMPLATES, sendNotification } from '@/services/notificationScheduler';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getWhatsAppService } from '@/services/whatsapp';

const situacaoColors: Record<string, string> = {
  Testando: 'bg-blue-500',
  Ativo: 'bg-green-500',
  Devendo: 'bg-yellow-500',
  Inativo: 'bg-gray-500',
  Lead: 'bg-purple-500',
};

export default function AdminClientes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, loading } = useLocalAuth();
  const { clientes, deleteCliente } = useClientes();
  const { isConfigured } = useWhatsAppConfig();
  const { addLog } = useNotificationLogs();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/admin/login');
    return null;
  }

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteCliente(deleteId);
      setDeleteId(null);
      setShowConfirm(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedCliente || !selectedTemplate) {
      toast({
        title: 'Erro',
        description: 'Selecione um template',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const template = LOCAL_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) throw new Error('Template não encontrado');

      await sendNotification(selectedCliente, template, addLog);
      
      toast({
        title: 'Sucesso!',
        description: `Mensagem enviada para ${selectedCliente.nome}`,
      });

      setSelectedCliente(null);
      setSelectedTemplate('');
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendFile = async () => {
    if (!selectedCliente || !file) {
      toast({
        title: 'Erro',
        description: 'Selecione um arquivo',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const whatsappService = getWhatsAppService();
      if (!whatsappService) {
        throw new Error('WhatsApp não configurado');
      }

      const response = await whatsappService.sendFile(
        selectedCliente.telefone,
        file,
        fileMessage || undefined
      );

      const fileInfo = getFileInfo();
      addLog({
        clienteId: selectedCliente.id,
        clienteNome: selectedCliente.nome,
        telefone: selectedCliente.telefone,
        tipo: 'arquivo',
        template: 'Envio de Arquivo',
        status: response.message_status === 'success' ? 'success' : 'error',
        resposta: response,
        arquivoEnviado: fileInfo ? {
          nome: fileInfo.name,
          tipo: fileInfo.type,
          tamanho: fileInfo.size,
        } : undefined,
      });

      toast({
        title: 'Sucesso!',
        description: `Arquivo enviado para ${selectedCliente.nome}`,
      });

      setSelectedCliente(null);
      setFileMessage('');
      clearFile();
      setShowFileDialog(false);
    } catch (error: any) {
      addLog({
        clienteId: selectedCliente.id,
        clienteNome: selectedCliente.nome,
        telefone: selectedCliente.telefone,
        tipo: 'arquivo',
        template: 'Envio de Arquivo',
        status: 'error',
        erro: error.message,
      });

      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const getDaysUntilBadge = (dataVencimento: string) => {
    if (!dataVencimento) return null;
    
    const days = getDaysUntilDue(dataVencimento);
    
    if (days < 0) {
      // Vencido (passado)
      return <Badge variant="destructive" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Vencido há {Math.abs(days)}d
      </Badge>;
    }
    if (days === 0) {
      return <Badge variant="default" className="flex items-center gap-1 bg-orange-500">
        <Clock className="h-3 w-3" />
        Vence hoje
      </Badge>;
    }
    if (days <= 5) {
      // Vence em breve (futuro próximo)
      return <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-500">
        <Clock className="h-3 w-3" />
        Vence em {days}d
      </Badge>;
    }
    if (days <= 30) {
      // Vencimento futuro normal
      return <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Vence em {days}d
      </Badge>;
    }
    // Vencimento distante
    return <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" />
      Vence em {days}d
    </Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Gerenciar Clientes
            </h1>
          </div>
          <Button onClick={() => navigate('/admin/clientes/novo')} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        <Card className="p-3 sm:p-4 lg:p-6">
          <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
            <div className="inline-block min-w-full align-middle">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nome</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Email</TableHead>
                    <TableHead className="whitespace-nowrap">Telefone</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Situação</TableHead>
                    <TableHead className="whitespace-nowrap hidden xl:table-cell">Plano</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Vencimento</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">Ativo</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente: Cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium whitespace-nowrap">{cliente.nome}</TableCell>
                      <TableCell className="hidden md:table-cell">{cliente.email}</TableCell>
                      <TableCell className="whitespace-nowrap">{cliente.telefone}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className={situacaoColors[cliente.situacao]}>
                          {cliente.situacao}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">{cliente.plano}</TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">
                      {cliente.dataVencimento
                        ? new Date(cliente.dataVencimento).toLocaleDateString('pt-BR')
                        : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {cliente.dataVencimento && getDaysUntilBadge(cliente.dataVencimento)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {cliente.clienteAtivo ? (
                          <Badge variant="default" className="bg-green-600">
                            Usando
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-500">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={!isConfigured || !cliente.telefone}
                            onClick={() => {
                              setSelectedCliente(cliente);
                              setSelectedTemplate('');
                            }}
                            title={!isConfigured ? 'Configure WhatsApp primeiro' : !cliente.telefone ? 'Cliente sem telefone' : 'Enviar WhatsApp'}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Enviar WhatsApp para {cliente.nome}</DialogTitle>
                            <DialogDescription>
                              Escolha um template de mensagem
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Template</Label>
                              <select
                                className="w-full p-2 border rounded-md bg-background"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                              >
                                <option value="">Selecione um template</option>
                                {LOCAL_TEMPLATES.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {selectedTemplate && (
                              <div className="space-y-2">
                                <Label>Preview da Mensagem</Label>
                                <Textarea
                                  value={LOCAL_TEMPLATES.find(t => t.id === selectedTemplate)?.message
                                    .replace(/{nome}/g, cliente.nome)
                                    .replace(/{valor}/g, cliente.valorPago.toFixed(2))
                                    .replace(/{dataVencimento}/g, cliente.dataVencimento ? new Date(cliente.dataVencimento).toLocaleDateString('pt-BR') : '')
                                  }
                                  readOnly
                                  rows={4}
                                />
                              </div>
                            )}

                            <Button 
                              onClick={handleSendWhatsApp} 
                              disabled={!selectedTemplate || sending}
                              className="w-full"
                            >
                              {sending ? 'Enviando...' : 'Enviar Agora'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={!isConfigured || !cliente.telefone}
                            onClick={() => {
                              setSelectedCliente(cliente);
                              clearFile();
                              setFileMessage('');
                            }}
                            title={!isConfigured ? 'Configure WhatsApp primeiro' : !cliente.telefone ? 'Cliente sem telefone' : 'Enviar Arquivo'}
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Enviar Arquivo para {cliente.nome}</DialogTitle>
                            <DialogDescription>
                              Selecione um arquivo para enviar via WhatsApp
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Arquivo</Label>
                              <Input
                                type="file"
                                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,.docx,.xlsx,.csv,.txt,.mp3,.mp4,.ogg,.wav,.opus"
                              />
                              {fileError && (
                                <p className="text-sm text-destructive">{fileError}</p>
                              )}
                              {file && !fileError && (
                                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileIcon className="h-4 w-4" />
                                      <div>
                                        <p className="text-sm font-medium">{getFileInfo()?.name}</p>
                                        <p className="text-xs text-muted-foreground">{getFileInfo()?.sizeFormatted}</p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={clearFile}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {preview && (
                                    <img 
                                      src={preview} 
                                      alt="Preview" 
                                      className="mt-2 max-h-40 rounded-md object-contain"
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label>Mensagem (opcional)</Label>
                              <Textarea
                                value={fileMessage}
                                onChange={(e) => setFileMessage(e.target.value)}
                                placeholder="Digite uma mensagem para acompanhar o arquivo..."
                                rows={3}
                              />
                            </div>

                            <Button 
                              onClick={handleSendFile} 
                              disabled={!file || sending || !!fileError}
                              className="w-full"
                            >
                              {sending ? 'Enviando...' : 'Enviar Arquivo'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/admin/clientes/editar/${cliente.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(cliente.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
