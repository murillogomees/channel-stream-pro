import { useState } from 'react';
import { useProfiles } from '@/hooks/useProfiles';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useTestContacts } from '@/hooks/useTestContacts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
import { Send, MessageSquare, Paperclip, X, FileIcon } from 'lucide-react';
import { LOCAL_TEMPLATES, sendNotification } from '@/services/notificationScheduler';
import { Cliente } from '@/types/cliente';
import { formatPhoneForDisplay } from '@/utils/phoneFormatter';
import { getWhatsAppService } from '@/services/whatsapp';

export default function AdminNotificacoes() {
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const { config, loading: configLoading } = useWhatsAppConfig();
  const { contacts: testContacts } = useTestContacts();
  const isConfigured = config.appkey.length > 0 && config.authkey.length > 0;
  const { addLog } = useNotificationLogs();
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [fileMessage, setFileMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
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

  // Combinar profiles reais com contatos de teste para envio
  const allContactsForSending = [
    ...profiles,
    ...testContacts.map(contact => ({
      id: contact.id,
      nome: `${contact.name} (Teste)`,
      telefone: contact.phone,
      email: '',
      situacao: 'Testando',
      created_at: contact.created_at,
      updated_at: contact.updated_at,
      data_contratacao: contact.created_at,
      data_vencimento: contact.created_at,
      plano: 'Mensal',
      valor_pago: 0,
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

  return (
    <div className="space-y-6">
      {/* Header com Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Envio Manual</h2>
          <p className="text-sm text-muted-foreground">
            Envie mensagens manualmente para clientes específicos
          </p>
        </div>
        <Badge variant={isConfigured ? 'default' : 'destructive'}>
          {isConfigured ? 'WhatsApp Configurado' : 'Não Configurado'}
        </Badge>
      </div>

      {/* Nota sobre contatos de teste */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            💡 Gerencie os contatos de teste na aba "Contatos de Teste" para usar nos envios manuais.
          </p>
        </CardContent>
      </Card>

      {/* Envio Manual */}
      <Card>
        <CardHeader>
          <CardTitle>Nova Mensagem</CardTitle>
          <CardDescription>
            Selecione um cliente e envie uma mensagem de texto ou arquivo
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
                        const profile = profiles.find(c => c.id === e.target.value);
                        setSelectedCliente(profile ? {
                          id: profile.id,
                          nome: profile.nome,
                          telefone: profile.contact_phone || '',
                          email: profile.email,
                          situacao: profile.situacao as any || 'Testando',
                          dataContratacao: profile.data_contratacao || profile.created_at,
                          dataVencimento: profile.data_vencimento || '',
                          plano: profile.plano as any || 'Mensal',
                          valorPago: profile.valor_pago || 0,
                          dataCadastro: profile.created_at,
                          dataUltimaEdicao: profile.updated_at,
                          clienteAtivo: profile.cliente_ativo ?? true,
                        } as Cliente : null);
                      }}
                    >
                      <option value="">Selecione um cliente</option>
                      {profiles.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} - {formatPhoneForDisplay(c.contact_phone || '')}
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
                        const profile = profiles.find(c => c.id === e.target.value);
                        setSelectedCliente(profile ? {
                          id: profile.id,
                          nome: profile.nome,
                          telefone: profile.contact_phone || '',
                          email: profile.email,
                          situacao: profile.situacao as any || 'Testando',
                          dataContratacao: profile.data_contratacao || profile.created_at,
                          dataVencimento: profile.data_vencimento || '',
                          plano: profile.plano as any || 'Mensal',
                          valorPago: profile.valor_pago || 0,
                          dataCadastro: profile.created_at,
                          dataUltimaEdicao: profile.updated_at,
                          clienteAtivo: profile.cliente_ativo ?? true,
                        } as Cliente : null);
                      }}
                    >
                      <option value="">Selecione um cliente</option>
                      {profiles.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} - {formatPhoneForDisplay(c.contact_phone || '')}
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
    </div>
  );
}
