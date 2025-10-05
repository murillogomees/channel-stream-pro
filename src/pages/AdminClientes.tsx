import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { useClientes } from '@/hooks/useClientes';
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
import { Pencil, Trash2, Plus, ArrowLeft, MessageSquare, Clock } from 'lucide-react';
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
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { LOCAL_TEMPLATES, sendNotification } from '@/services/notificationScheduler';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  const [sending, setSending] = useState(false);

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

  const getDaysUntilBadge = (dataVencimento: string) => {
    const days = getDaysUntilDue(dataVencimento);
    if (days < 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Vencido há {Math.abs(days)}d
      </Badge>;
    }
    if (days === 0) {
      return <Badge variant="default" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Vence hoje
      </Badge>;
    }
    if (days <= 5) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Vence em {days}d
      </Badge>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Gerenciar Clientes
            </h1>
          </div>
          <Button onClick={() => navigate('/admin/clientes/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        <Card className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente: Cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium">{cliente.nome}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>{cliente.telefone}</TableCell>
                    <TableCell>
                      <Badge className={situacaoColors[cliente.situacao]}>
                        {cliente.situacao}
                      </Badge>
                    </TableCell>
                    <TableCell>{cliente.plano}</TableCell>
                    <TableCell>
                      {cliente.dataVencimento
                        ? new Date(cliente.dataVencimento).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {cliente.dataVencimento && getDaysUntilBadge(cliente.dataVencimento)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
