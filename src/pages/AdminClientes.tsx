import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfiles, UnifiedProfile } from '@/hooks/useProfiles';
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
import { Pencil, Trash2, Plus, ArrowLeft, MessageSquare, Clock, Paperclip, X, FileIcon, Filter, Download, Users, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { getDaysUntilDue } from '@/services/notificationScheduler';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
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

// Labels amigáveis para dispositivos
const dispositivoLabels: Record<string, string> = {
  smart_tv: 'Smart TV',
  roku_tv: 'Roku TV',
  fire_stick: 'Fire Stick',
  android_tv: 'Android TV',
  celular_android: 'Celular Android',
  celular_ios: 'Celular iOS (iPhone)',
  computador: 'Computador',
  mac: 'Mac',
  tablet_android: 'Tablet Android',
  tablet_ios: 'Tablet iOS (iPad)',
  chromecast: 'Chromecast',
  apple_tv: 'Apple TV',
  xbox: 'Xbox',
  playstation: 'PlayStation',
};

export default function AdminClientes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profiles, deleteProfile, loading: loadingClientes } = useProfiles();
  const { config } = useWhatsAppConfig();
  const isConfigured = config.appkey.length > 0 && config.authkey.length > 0;
  const { addLog } = useNotificationLogs();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const LOCAL_TEMPLATES = loadTemplates();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<UnifiedProfile | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();
  const [clienteM3ULists, setClienteM3ULists] = useState<Record<string, string>>({});

  // Filtros avançados
  const [filterPlano, setFilterPlano] = useState<string>('all');
  const [filterOrigem, setFilterOrigem] = useState<string>('all');
  const [filterVencimento, setFilterVencimento] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Criação de contas em massa
  const [showBatchAuthDialog, setShowBatchAuthDialog] = useState(false);
  const [batchPassword, setBatchPassword] = useState('');
  const [showBatchPassword, setShowBatchPassword] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [clientesWithoutAuth, setClientesWithoutAuth] = useState<number>(0);

  const filteredClientes = useMemo(() => {
    return profiles.filter(cliente => {
      // Filtro de plano
      if (filterPlano !== 'all' && cliente.plano !== filterPlano) {
        return false;
      }

      // Filtro de origem
      if (filterOrigem !== 'all' && cliente.origem_cadastro !== filterOrigem) {
        return false;
      }

      // Filtro de vencimento
      if (filterVencimento !== 'all' && cliente.data_vencimento) {
        const daysUntilDue = getDaysUntilDue(cliente.data_vencimento);
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
  }, [profiles, filterPlano, filterOrigem, filterVencimento]);

  const resetFilters = () => {
    setFilterPlano('all');
    setFilterOrigem('all');
    setFilterVencimento('all');
  };

  const hasActiveFilters = filterPlano !== 'all' || filterOrigem !== 'all' || 
                          filterVencimento !== 'all';

  // Contar clientes sem conta de acesso (usando profiles)
  useEffect(() => {
    const countWithoutAuth = async () => {
      try {
        // Contar profiles que têm email mas não foram vinculados a auth.users
        // Estes são profiles criados manualmente sem conta de autenticação
        const profilesWithEmail = profiles.filter(p => p.email && p.email.trim() !== '');
        // Assumimos que profiles migrados sem user_id real precisam de conta
        const withoutAuth = profilesWithEmail.filter(p => !p.id || p.situacao === 'Testando');
        setClientesWithoutAuth(withoutAuth.length);
      } catch (error) {
        console.error('Error counting clients without auth:', error);
      }
    };

    countWithoutAuth();
  }, [profiles]);

  // Função para criar contas em massa
  const handleBatchCreateAuth = async () => {
    if (!batchPassword || batchPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha padrão deve ter no mínimo 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setBatchProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-client-auth-batch', {
        body: { defaultPassword: batchPassword }
      });

      if (error) throw error;

      toast({
        title: 'Processo concluído',
        description: data.message || `${data.summary?.success || 0} contas criadas com sucesso`,
      });

      // Atualizar contagem
      setClientesWithoutAuth(data.summary?.failed || 0);
      setShowBatchAuthDialog(false);
      setBatchPassword('');
      
      // Recarregar lista
      window.location.reload();
    } catch (error: any) {
      console.error('Error creating batch auth:', error);
      toast({
        title: 'Erro ao criar contas',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setBatchProcessing(false);
    }
  };

  // M3U lists management removed - now using unified m3u_sync_entries

  if (loadingClientes) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteProfile(deleteId);
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

      const whatsappService = getWhatsAppService();
      const message = template.message
        .replace(/{nome}/g, selectedCliente.nome)
        .replace(/{valor}/g, selectedCliente.valor_pago?.toFixed(2) || '0.00')
        .replace(/{dataVencimento}/g, selectedCliente.data_vencimento ? new Date(selectedCliente.data_vencimento).toLocaleDateString('pt-BR') : '');
      
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
          <div className="flex gap-2 flex-wrap">
            {clientesWithoutAuth > 0 && (
              <Button 
                variant="outline"
                onClick={() => setShowBatchAuthDialog(true)}
                className="text-amber-600 border-amber-600/50 hover:bg-amber-600/10"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Criar Contas ({clientesWithoutAuth})
              </Button>
            )}
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/admin/usuarios?tab=create')} className="w-full sm:w-auto">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    Mostrando {filteredClientes.length} de {profiles.length} clientes
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
                    <TableHead className="whitespace-nowrap hidden md:table-cell">MAC</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Dispositivo</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Situação</TableHead>
                    <TableHead className="whitespace-nowrap hidden xl:table-cell">Plano</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Vencimento</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">Lista M3U</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {hasActiveFilters 
                          ? 'Nenhum cliente encontrado com os filtros aplicados' 
                          : 'Nenhum cliente cadastrado ainda'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClientes.map((cliente: UnifiedProfile) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium whitespace-nowrap">{cliente.nome}</TableCell>
                      <TableCell className="hidden md:table-cell">{cliente.email || 'N/A'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{cliente.dispositivo_contratado ? dispositivoLabels[cliente.dispositivo_contratado] || cliente.dispositivo_contratado : 'N/A'}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className={situacaoColors[cliente.situacao || 'Indefinido']}>
                          {cliente.situacao || 'Indefinido'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">{cliente.plano}</TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">
                      {cliente.data_vencimento
                        ? new Date(cliente.data_vencimento).toLocaleDateString('pt-BR')
                        : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {cliente.data_vencimento && getDaysUntilBadge(cliente.data_vencimento)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {clienteM3ULists[cliente.id] || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!isConfigured || !cliente.telefone}
                        onClick={() => {
                          setSelectedCliente(cliente);
                          setSelectedTemplate('');
                          setShowWhatsAppDialog(true);
                        }}
                        title={!isConfigured ? 'Configure WhatsApp primeiro' : !cliente.telefone ? 'Cliente sem telefone' : 'Enviar WhatsApp'}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!isConfigured || !cliente.telefone}
                        onClick={() => {
                          setSelectedCliente(cliente);
                          clearFile();
                          setFileMessage('');
                          setShowFileDialog(true);
                        }}
                        title={!isConfigured ? 'Configure WhatsApp primeiro' : !cliente.telefone ? 'Cliente sem telefone' : 'Enviar Arquivo'}
                      >
                      <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/admin/usuarios?edit=${cliente.id}`)}
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

      {/* Dialog de WhatsApp */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp para {selectedCliente?.nome}</DialogTitle>
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

            {selectedTemplate && selectedCliente && (
              <div className="space-y-2">
                <Label>Preview da Mensagem</Label>
                <Textarea
                  value={LOCAL_TEMPLATES.find(t => t.id === selectedTemplate)?.message
                    .replace(/{nome}/g, selectedCliente.nome)
                    .replace(/{valor}/g, selectedCliente.valor_pago?.toFixed(2) || '0.00')
                    .replace(/{dataVencimento}/g, selectedCliente.data_vencimento ? new Date(selectedCliente.data_vencimento).toLocaleDateString('pt-BR') : '')
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

      {/* Dialog de Arquivo */}
      <Dialog open={showFileDialog} onOpenChange={setShowFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Arquivo para {selectedCliente?.nome}</DialogTitle>
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

      {/* Dialog de Criação de Contas em Massa */}
      <Dialog open={showBatchAuthDialog} onOpenChange={setShowBatchAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Criar Contas de Acesso em Massa
            </DialogTitle>
            <DialogDescription>
              Isso criará contas de login para {clientesWithoutAuth} cliente(s) que ainda não possuem acesso ao sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-600">
                <strong>Atenção:</strong> Todos os clientes receberão a mesma senha inicial. 
                Recomende que alterem a senha no primeiro acesso.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Senha Padrão Temporária</Label>
              <div className="relative">
                <Input
                  type={showBatchPassword ? 'text' : 'password'}
                  value={batchPassword}
                  onChange={(e) => setBatchPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowBatchPassword(!showBatchPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showBatchPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta será a senha inicial para todos os clientes. Eles devem alterá-la após o primeiro login.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBatchAuthDialog(false);
                  setBatchPassword('');
                }}
                className="flex-1"
                disabled={batchProcessing}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleBatchCreateAuth} 
                disabled={batchProcessing || batchPassword.length < 6}
                className="flex-1"
              >
                {batchProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Criar {clientesWithoutAuth} Contas
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
