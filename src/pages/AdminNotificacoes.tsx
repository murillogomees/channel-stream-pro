import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useClientes } from '@/hooks/useClientes';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAutoNotifications } from '@/hooks/useAutoNotifications';
import { validateBrazilianPhone } from '@/utils/phoneValidator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, MessageSquare, Download, Trash2, CheckCircle, XCircle, Paperclip, X, FileIcon, Play, Clock, AlertCircle, Plus, User } from 'lucide-react';
import { LOCAL_TEMPLATES, getDaysUntilDue, sendNotification } from '@/services/notificationScheduler';
import { Cliente } from '@/types/cliente';
import { formatPhoneForDisplay } from '@/utils/phoneFormatter';
import { getWhatsAppService } from '@/services/whatsapp';

export default function AdminNotificacoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading } = useAuth();
  const { clientes } = useClientes();
  const { config, saveConfig, isConfigured, addTestContact, removeTestContact } = useWhatsAppConfig();
  const { logs, addLog, clearLogs, getRecentLogs, exportToCSV } = useNotificationLogs();
  const { isRunning, lastRunState, forceRun, getNextRunTime, getErrorHandler } = useAutoNotifications();
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  const [phoneValidation, setPhoneValidation] = useState<{
    isValid: boolean;
    error?: string;
    formatted?: string;
  }>({ isValid: true });
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactValidation, setNewContactValidation] = useState<{
    isValid: boolean;
    error?: string;
    formatted?: string;
  }>({ isValid: false });
  const [testingCredentials, setTestingCredentials] = useState(false);
  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();

  const errorHandler = getErrorHandler();
  const recentErrors = errorHandler?.getRecentErrors() || [];
  const nextRunTime = getNextRunTime();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, loading, navigate]);

  // Validar número de teste quando mudar
  useEffect(() => {
    if (config.testPhoneNumber) {
      const validation = validateBrazilianPhone(config.testPhoneNumber);
      setPhoneValidation(validation);
    } else {
      setPhoneValidation({ isValid: true });
    }
  }, [config.testPhoneNumber]);

  // Validar novo contato quando mudar
  useEffect(() => {
    if (newContactPhone) {
      const validation = validateBrazilianPhone(newContactPhone);
      setNewContactValidation(validation);
    } else {
      setNewContactValidation({ isValid: false });
    }
  }, [newContactPhone]);

  const handleAddContact = () => {
    if (!newContactName.trim()) {
      toast({
        title: 'Erro',
        description: 'Digite um nome para o contato',
        variant: 'destructive',
      });
      return;
    }

    const validation = validateBrazilianPhone(newContactPhone);
    if (!validation.isValid) {
      toast({
        title: 'Erro',
        description: validation.error || 'Número inválido',
        variant: 'destructive',
      });
      return;
    }

    addTestContact(newContactName.trim(), newContactPhone);
    toast({
      title: 'Sucesso!',
      description: 'Contato adicionado com sucesso',
    });
    setNewContactName('');
    setNewContactPhone('');
    setIsAddingContact(false);
  };

  const handleRemoveContact = (id: string, name: string) => {
    removeTestContact(id);
    toast({
      title: 'Sucesso!',
      description: `Contato "${name}" removido`,
    });
  };

  const handleTestCredentials = async () => {
    setTestingCredentials(true);
    try {
      const whatsappService = getWhatsAppService();
      if (!whatsappService) {
        toast({
          title: 'Erro',
          description: 'Configure as credenciais do WhatsApp primeiro',
          variant: 'destructive',
        });
        return;
      }

      const result = await whatsappService.verifyCredentials();
      
      if (result.valid) {
        toast({
          title: 'Credenciais Válidas! ✅',
          description: 'Suas credenciais BotBot estão funcionando corretamente.',
        });
      } else {
        toast({
          title: 'Credenciais Inválidas ❌',
          description: result.error || 'Verifique suas credenciais BotBot',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao testar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTestingCredentials(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const handleSendManual = async () => {
    if (!selectedCliente || !selectedTemplate) {
      toast({
        title: 'Erro',
        description: 'Selecione um cliente e um template',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      // Verificar credenciais antes de enviar
      const whatsappService = getWhatsAppService();
      if (!whatsappService) {
        throw new Error('Configure as credenciais do WhatsApp primeiro');
      }

      const credentialsCheck = await whatsappService.verifyCredentials();
      if (!credentialsCheck.valid) {
        toast({
          title: 'Credenciais Inválidas',
          description: credentialsCheck.error || 'Verifique suas credenciais BotBot',
          variant: 'destructive',
        });
        setSending(false);
        return;
      }

      const template = LOCAL_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) throw new Error('Template não encontrado');

      await sendNotification(selectedCliente, template, addLog);
      
      toast({
        title: 'Sucesso!',
        description: `Mensagem enviada para ${selectedCliente.nome}`,
      });

      setSelectedCliente(null);
      setSelectedTemplate('');
      setCustomMessage('');
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

  // Combinar clientes reais com contatos de teste para envio
  const allContactsForSending = [
    ...clientes,
    ...(config.testContacts || []).map(contact => ({
      id: contact.id,
      nome: `${contact.name} (Teste)`,
      telefone: contact.phone,
      telegram: '',
      email: '',
      situacao: 'Testando' as const,
      dataContratacao: contact.addedAt,
      dataVencimento: contact.addedAt,
      plano: 'Mensal' as const,
      valorPago: 0,
      dataUltimoPagamento: contact.addedAt,
      formaUltimoPagamento: '',
      macSmartOne: '',
      usuario: '',
      senha: '',
      dataCadastro: contact.addedAt,
      dataUltimaEdicao: contact.addedAt,
      clienteAtivo: true,
      origemCadastro: 'Outro' as const,
    }))
  ];

  const handleSendFile = async () => {
    if (!selectedCliente || !file) {
      toast({
        title: 'Erro',
        description: 'Selecione um cliente e um arquivo',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      // Verificar credenciais antes de enviar
      const whatsappService = getWhatsAppService();
      if (!whatsappService) {
        throw new Error('Configure as credenciais do WhatsApp primeiro');
      }

      const credentialsCheck = await whatsappService.verifyCredentials();
      if (!credentialsCheck.valid) {
        toast({
          title: 'Credenciais Inválidas',
          description: credentialsCheck.error || 'Verifique suas credenciais BotBot',
          variant: 'destructive',
        });
        setSending(false);
        return;
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

  const clientesComVencimento = clientes
    .filter(c => c.dataVencimento)
    .map(c => ({
      ...c,
      daysUntil: getDaysUntilDue(c.dataVencimento),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const recentLogs = getRecentLogs(20);

  const handleForceRun = async () => {
    setRunningManual(true);
    try {
      await forceRun();
      toast({
        title: 'Sucesso!',
        description: 'Envio manual executado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRunningManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Notificações WhatsApp
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sistema automático de lembretes de pagamento
              </p>
            </div>
          </div>
          <Badge variant={isConfigured ? 'default' : 'destructive'}>
            {isConfigured ? 'Configurado' : 'Não Configurado'}
          </Badge>
        </div>

        {/* Status do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
            <CardDescription>
              Monitoramento do envio automático de notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Sistema Automático:</span>
                  <Badge variant={config.autoSendEnabled ? 'default' : 'secondary'}>
                    {config.autoSendEnabled ? '🟢 Ativo' : '⚫ Desativado'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Status Atual:</span>
                  <Badge variant={isRunning ? 'default' : 'outline'}>
                    {isRunning ? '⚡ Processando' : '💤 Aguardando'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Última Execução:</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {lastRunState?.lastRunDate 
                      ? new Date(lastRunState.lastRunDate).toLocaleDateString('pt-BR')
                      : 'Nunca'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Próxima Execução:</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {nextRunTime 
                      ? nextRunTime.toLocaleString('pt-BR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      : 'Não agendado'}
                  </span>
                </div>
              </div>
            </div>

            {lastRunState && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Mensagens Enviadas</p>
                  <p className="text-2xl font-bold text-green-500">{lastRunState.totalSent}</p>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Erros</p>
                  <p className="text-2xl font-bold text-red-500">{lastRunState.errors}</p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleForceRun} 
              variant="outline" 
              className="w-full"
              disabled={!isConfigured || runningManual}
            >
              <Play className="mr-2 h-4 w-4" />
              {runningManual ? 'Executando...' : '🔄 Executar Agora (Teste)'}
            </Button>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Configure o envio automático de notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sistema Automático</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar notificações automaticamente de acordo com o vencimento
                </p>
              </div>
              <Switch
                checked={config.autoSendEnabled}
                onCheckedChange={(checked) => saveConfig({ autoSendEnabled: checked })}
                disabled={!isConfigured}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de Envio</Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={config.sendHour}
                  onChange={(e) => saveConfig({ sendHour: parseInt(e.target.value) })}
                  disabled={!isConfigured}
                />
                <p className="text-xs text-muted-foreground">
                  Horário para envio automático (0-23)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Número para Testes</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="5561999999999"
                    value={config.testPhoneNumber || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Remove não-dígitos
                      saveConfig({ testPhoneNumber: value });
                    }}
                    disabled={!isConfigured}
                    className={!phoneValidation.isValid && config.testPhoneNumber ? 'border-red-500' : ''}
                  />
                  {!phoneValidation.isValid && config.testPhoneNumber && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {phoneValidation.error}
                    </p>
                  )}
                  {phoneValidation.isValid && phoneValidation.formatted && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {phoneValidation.formatted}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato: 55 + DDD + Número (ex: 5561996975924)
                </p>
              </div>
            </div>

            {config.testPhoneNumber && phoneValidation.isValid && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 p-3 rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Número de teste válido: <span className="font-mono">{phoneValidation.formatted}</span>
                </p>
                <p className="text-xs mt-1 opacity-80">
                  Este número será usado para enviar mensagens de teste dos templates
                </p>
              </div>
            )}

            {config.testPhoneNumber && !phoneValidation.isValid && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Número de teste inválido
                </p>
                <p className="text-xs mt-1 opacity-80">
                  Corrija o formato do número antes de enviar testes
                </p>
              </div>
            )}

            {!isConfigured && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-lg">
                <p className="text-sm font-medium">
                  ⚠️ Configure as credenciais BotBot.chat no Dashboard primeiro
                </p>
              </div>
            )}

            {isConfigured && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleTestCredentials}
                  disabled={testingCredentials}
                  variant="outline"
                  className="w-full"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {testingCredentials ? 'Testando...' : 'Testar Credenciais BotBot'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Verifica se suas credenciais estão válidas e ativas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Contatos de Teste */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contatos de Teste
            </CardTitle>
            <CardDescription>
              Gerencie uma lista de contatos para envio rápido de testes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
              <DialogTrigger asChild>
                <Button className="w-full" disabled={!isConfigured}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Contato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Contato de Teste</DialogTitle>
                  <DialogDescription>
                    Adicione um novo contato à lista de números para envio de testes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Nome do Contato</Label>
                    <Input
                      id="contact-name"
                      placeholder="Ex: João Silva"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Telefone</Label>
                    <Input
                      id="contact-phone"
                      placeholder="Ex: 5561996975924"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value.replace(/\D/g, ''))}
                      className={!newContactValidation.isValid && newContactPhone ? 'border-red-500' : ''}
                    />
                    {newContactPhone && (
                      <div className="flex items-center gap-2 text-sm">
                        {newContactValidation.isValid ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">{newContactValidation.formatted}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-red-600 dark:text-red-400">{newContactValidation.error}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={handleAddContact}
                    disabled={!newContactValidation.isValid || !newContactName.trim()}
                    className="w-full"
                  >
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {config.testContacts && config.testContacts.length > 0 ? (
              <div className="space-y-2">
                {config.testContacts.map((contact) => {
                  const validation = validateBrazilianPhone(contact.phone);
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {validation.formatted || contact.phone}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveContact(contact.id, contact.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum contato salvo</p>
                <p className="text-sm">Adicione contatos para envio rápido de testes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Envio Manual */}
        <Card>
          <CardHeader>
            <CardTitle>Envio Manual</CardTitle>
            <CardDescription>
              Envie mensagens manualmente para clientes específicos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button disabled={!isConfigured}>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Mensagem
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Enviar Mensagem WhatsApp</DialogTitle>
                  <DialogDescription>
                    Escolha entre enviar mensagem de texto ou arquivo
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="text" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Mensagem de Texto
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <Paperclip className="mr-2 h-4 w-4" />
                      Enviar Arquivo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={selectedCliente?.id || ''}
                        onChange={(e) => {
                          const cliente = allContactsForSending.find(c => c.id === e.target.value);
                          setSelectedCliente(cliente || null);
                        }}
                      >
                        <option value="">Selecione um cliente</option>
                        {allContactsForSending.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nome} - {formatPhoneForDisplay(c.telefone)}
                          </option>
                        ))}
                      </select>
                    </div>

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
                            .replace(/{valor}/g, selectedCliente.valorPago.toFixed(2))
                            .replace(/{dataVencimento}/g, selectedCliente.dataVencimento ? new Date(selectedCliente.dataVencimento).toLocaleDateString('pt-BR') : '')
                          }
                          readOnly
                          rows={4}
                        />
                      </div>
                    )}

                    <Button 
                      onClick={handleSendManual} 
                      disabled={!selectedCliente || !selectedTemplate || sending}
                      className="w-full"
                    >
                      {sending ? 'Enviando...' : 'Enviar Mensagem'}
                    </Button>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={selectedCliente?.id || ''}
                        onChange={(e) => {
                          const cliente = allContactsForSending.find(c => c.id === e.target.value);
                          setSelectedCliente(cliente || null);
                        }}
                      >
                        <option value="">Selecione um cliente</option>
                        {allContactsForSending.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nome} - {formatPhoneForDisplay(c.telefone)}
                          </option>
                        ))}
                      </select>
                    </div>

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
                      disabled={!selectedCliente || !file || sending || !!fileError}
                      className="w-full"
                    >
                      {sending ? 'Enviando...' : 'Enviar Arquivo'}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Próximas Notificações */}
        <Card>
          <CardHeader>
            <CardTitle>Próximas Notificações</CardTitle>
            <CardDescription>
              Clientes que receberão notificações nos próximos dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dias até vencer</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesComVencimento.slice(0, 10).map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell>{formatPhoneForDisplay(cliente.telefone)}</TableCell>
                      <TableCell>
                        {new Date(cliente.dataVencimento).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cliente.daysUntil < 0 ? 'destructive' : cliente.daysUntil <= 2 ? 'default' : 'secondary'}>
                          {cliente.daysUntil > 0 ? `${cliente.daysUntil} dias` : cliente.daysUntil === 0 ? 'Hoje' : `${Math.abs(cliente.daysUntil)} dias vencido`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{cliente.situacao}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Erros Recentes */}
        {recentErrors.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Erros Recentes
                  </CardTitle>
                  <CardDescription>
                    Últimos erros de envio de notificações
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => errorHandler?.clearErrors()}
                >
                  Limpar Erros
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead>Tentativas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentErrors.map((error, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {new Date(error.timestamp).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>{error.clienteNome}</TableCell>
                        <TableCell className="max-w-md truncate text-sm text-destructive">
                          {error.error}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{error.retryCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Envios */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Histórico de Envios</CardTitle>
                <CardDescription>
                  Últimas 20 notificações enviadas
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.dataEnvio).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{log.clienteNome}</TableCell>
                      <TableCell>{formatPhoneForDisplay(log.telefone)}</TableCell>
                      <TableCell className="text-sm">{log.template}</TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Enviado
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            Erro
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum envio registrado ainda
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
