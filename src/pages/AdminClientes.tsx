import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClientesDb } from '@/hooks/useClientesDb';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Pencil, Trash2, Plus, ArrowLeft, MessageSquare, Clock, Paperclip, X, FileIcon, ExternalLink, Filter, Download } from 'lucide-react';
import { Cliente } from '@/types/cliente';
import { getDaysUntilDue } from '@/services/notificationScheduler';
import { useToast } from '@/hooks/use-toast';
import { SmartOneDataDialog } from '@/components/admin/SmartOneDataDialog';
import { supabase } from '@/integrations/supabase/client';
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
import { loadTemplates } from '@/services/notificationScheduler';
import { getWhatsAppService } from '@/services/whatsapp';
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
  const { isAdmin, loading } = useAuth();
  const { clientes, deleteCliente, loading: loadingClientes } = useClientesDb();
  const { isConfigured } = useWhatsAppConfig();
  const { addLog } = useNotificationLogs();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const LOCAL_TEMPLATES = loadTemplates();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();
  const [showSmartOneData, setShowSmartOneData] = useState(false);
  const [smartOneClientData, setSmartOneClientData] = useState<{
    nome: string;
    macSmartOne: string;
    m3uLists: Array<{ name: string; file_url: string }>;
  } | null>(null);

  // Filtros avançados
  const [filterPlano, setFilterPlano] = useState<string>('all');
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterSmartOneStatus, setFilterSmartOneStatus] = useState<string>('all');
  const [filterVencimento, setFilterVencimento] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      // Filtro de plano
      if (filterPlano !== 'all' && cliente.plano !== filterPlano) {
        return false;
      }

      // Filtro de origem
      if (filterOrigem !== 'all' && cliente.origemCadastro !== filterOrigem) {
        return false;
      }

      // Filtro de status SmartOne
      if (filterSmartOneStatus !== 'all' && cliente.smartone_status !== filterSmartOneStatus) {
        return false;
      }

      // Filtro de vencimento
      if (filterVencimento !== 'all' && cliente.dataVencimento) {
        const daysUntilDue = getDaysUntilDue(cliente.dataVencimento);
        switch (filterVencimento) {
          case 'vencido':
            if (daysUntilDue >= 0) return false;
            break;
          case 'vence_hoje':
            if (daysUntilDue !== 0) return false;
            break;
          case 'vence_5_dias':
            if (daysUntilDue < 0 || daysUntilDue > 5) return false;
            break;
          case 'vence_30_dias':
            if (daysUntilDue < 0 || daysUntilDue > 30) return false;
            break;
          default:
            break;
        }
      }

      return true;
    });
  }, [clientes, filterPlano, filterOrigem, filterSmartOneStatus, filterVencimento]);

  const resetFilters = () => {
    setFilterPlano('all');
    setFilterOrigem('all');
    setFilterSmartOneStatus('all');
    setFilterVencimento('all');
  };

  const hasActiveFilters = filterPlano !== 'all' || filterOrigem !== 'all' || 
                          filterSmartOneStatus !== 'all' || filterVencimento !== 'all';

  if (loading || loadingClientes) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/auth');
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

  const handleViewSmartOneData = async (cliente: Cliente) => {
    if (!cliente.macSmartOne) {
      toast({
        title: 'Sem dados',
        description: 'Cliente não possui MAC Address cadastrado',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Buscar M3U lists atribuídas ao cliente
      const { data: m3uAssignments, error } = await supabase
        .from('client_m3u_lists')
        .select(`
          m3u_list_id,
          m3u_lists (
            id,
            name,
            file_url
          )
        `)
        .eq('client_id', cliente.id)
        .eq('is_active', true);

      if (error) throw error;

      const m3uLists = m3uAssignments?.map(assignment => ({
        name: (assignment.m3u_lists as any)?.name || 'N/A',
        file_url: (assignment.m3u_lists as any)?.file_url || '',
      })) || [];

      setSmartOneClientData({
        nome: cliente.nome,
        macSmartOne: cliente.macSmartOne,
        m3uLists,
      });
      setShowSmartOneData(true);
    } catch (error) {
      console.error('Error loading M3U lists:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as listas M3U',
        variant: 'destructive',
      });
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

      const whatsappService = getWhatsAppService();
      const message = template.message
        .replace(/{nome}/g, selectedCliente.nome)
        .replace(/{valor}/g, selectedCliente.valorPago?.toFixed(2) || '0.00')
        .replace(/{dataVencimento}/g, selectedCliente.dataVencimento ? new Date(selectedCliente.dataVencimento).toLocaleDateString('pt-BR') : '');
      
      await whatsappService.sendTextMessage(selectedCliente.telefone, message);
      await addLog({
        clienteId: selectedCliente.id,
        clienteNome: selectedCliente.nome,
        telefone: selectedCliente.telefone,
        tipo: template.id,
        template: template.name,
        status: 'success',
      });
      
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/admin/clientes/novo')} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Filtros Avançados */}
        {showFilters && (
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Filtros Avançados</h3>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Limpar Filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={filterPlano} onValueChange={setFilterPlano}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os planos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os planos</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origem de Cadastro</Label>
                  <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as origens" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as origens</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status SmartOne</Label>
                  <Select value={filterSmartOneStatus} onValueChange={setFilterSmartOneStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="nao_enviado">Não Enviado</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="criado">Criado</SelectItem>
                      <SelectItem value="erro">Erro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Select value={filterVencimento} onValueChange={setFilterVencimento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="vencido">Vencidos</SelectItem>
                      <SelectItem value="vence_hoje">Vence Hoje</SelectItem>
                      <SelectItem value="vence_5_dias">Vence em até 5 dias</SelectItem>
                      <SelectItem value="vence_30_dias">Vence em até 30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {filteredClientes.length} de {clientes.length} clientes
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

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
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">SmartOne</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {hasActiveFilters 
                          ? 'Nenhum cliente encontrado com os filtros aplicados' 
                          : 'Nenhum cliente cadastrado ainda'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClientes.map((cliente: Cliente) => (
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
                      <TableCell className="hidden lg:table-cell">
                        <Badge 
                          variant={
                            cliente.smartone_status === 'criado' ? "default" :
                            cliente.smartone_status === 'pendente' ? "secondary" :
                            cliente.smartone_status === 'erro' ? "destructive" :
                            "outline"
                          }
                          className={
                            cliente.smartone_status === 'criado' ? "bg-green-600" :
                            cliente.smartone_status === 'pendente' ? "bg-yellow-500" :
                            cliente.smartone_status === 'erro' ? "" :
                            ""
                          }
                        >
                          {cliente.smartone_status === 'criado' ? '✓ Criado' :
                           cliente.smartone_status === 'pendente' ? '⏳ Pendente' :
                           cliente.smartone_status === 'erro' ? '✗ Erro' :
                           '○ Não enviado'}
                        </Badge>
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
                        onClick={() => handleViewSmartOneData(cliente)}
                        disabled={!cliente.macSmartOne}
                        title={!cliente.macSmartOne ? 'Cliente sem MAC Address' : 'Ver dados para SmartOne'}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
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
                    ))
                  )}
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

      {/* Modal com dados para SmartOne */}
      {smartOneClientData && (
        <SmartOneDataDialog
          open={showSmartOneData}
          onOpenChange={setShowSmartOneData}
          clientData={smartOneClientData}
        />
      )}
    </div>
  );
}
