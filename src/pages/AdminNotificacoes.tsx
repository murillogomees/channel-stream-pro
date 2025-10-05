import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { useClientes } from '@/hooks/useClientes';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { useFileUpload } from '@/hooks/useFileUpload';
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
import { ArrowLeft, Send, MessageSquare, Download, Trash2, CheckCircle, XCircle, Paperclip, X, FileIcon } from 'lucide-react';
import { LOCAL_TEMPLATES, getDaysUntilDue, sendNotification } from '@/services/notificationScheduler';
import { Cliente } from '@/types/cliente';
import { formatPhoneForDisplay } from '@/utils/phoneFormatter';
import { getWhatsAppService } from '@/services/whatsapp';

export default function AdminNotificacoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, loading } = useLocalAuth();
  const { clientes } = useClientes();
  const { config, saveConfig, isConfigured } = useWhatsAppConfig();
  const { logs, addLog, clearLogs, getRecentLogs, exportToCSV } = useNotificationLogs();
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
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
              </div>
            </div>

            {!isConfigured && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-lg">
                <p className="text-sm font-medium">
                  ⚠️ Configure as credenciais BotBot.chat no Dashboard primeiro
                </p>
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
                          const cliente = clientes.find(c => c.id === e.target.value);
                          setSelectedCliente(cliente || null);
                        }}
                      >
                        <option value="">Selecione um cliente</option>
                        {clientes.map(c => (
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
                          const cliente = clientes.find(c => c.id === e.target.value);
                          setSelectedCliente(cliente || null);
                        }}
                      >
                        <option value="">Selecione um cliente</option>
                        {clientes.map(c => (
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
