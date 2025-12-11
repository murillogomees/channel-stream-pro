import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Info, Paperclip, FileIcon, X, Eye, Send, Settings, CheckCircle, AlertCircle, Users } from 'lucide-react';
import TemplatePreview from '@/components/TemplatePreview';
import TemplateVariablePicker from '@/components/TemplateVariablePicker';
import MessageSnippets from '@/components/MessageSnippets';
import { useFileUpload } from '@/hooks/useFileUpload';
import { validateBrazilianPhone } from '@/utils/phoneValidator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTemplates } from '@/hooks/useTemplates';
import { WhatsappTemplate, TemplateEventType } from '@/types/whatsapp';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

export default function AdminTemplates() {
  const navigate = useNavigate();
  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetToDefaults,
    extractVariables,
  } = useTemplates();

  const { file, preview, error: fileError, handleFileSelect, clearFile, getFileInfo } = useFileUpload();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);

  const [formData, setFormData] = useState<{
    name: string;
    message: string;
    daysBeforeDue: number;
    type: 'local' | 'botbot';
    eventType: TemplateEventType;
  }>({
    name: '',
    message: '',
    daysBeforeDue: 0,
    type: 'local',
    eventType: 'expiration',
  });
  
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [selectedTestPhones, setSelectedTestPhones] = useState<string[]>([]);
  const [testContacts, setTestContacts] = useState<any[]>([]);
  const [testPhoneValidation, setTestPhoneValidation] = useState<{
    isValid: boolean;
    error?: string;
    formatted?: string;
  }>({ isValid: true });

  // Setup realtime
  useEffect(() => {
    const channel = supabase
      .channel('notification_templates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_templates'
        },
        () => {
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);
  
  // Carregar e validar número de teste
  useEffect(() => {
    const configStored = localStorage.getItem('whatsapp_config');
    if (configStored) {
      try {
        const config = JSON.parse(configStored);
        const phoneNum = config.testPhoneNumber || '5561996975924';
        setTestPhoneNumber(phoneNum);
        setTestContacts(config.testContacts || []);
        
        // Validar números selecionados
        if (selectedTestPhones.length > 0) {
          const firstPhone = selectedTestPhones[0];
          const validation = validateBrazilianPhone(firstPhone);
          setTestPhoneValidation(validation);
        } else if (phoneNum) {
          const validation = validateBrazilianPhone(phoneNum);
          setTestPhoneValidation(validation);
        }
      } catch (error) {
        setTestPhoneNumber('5561996975924');
        setTestPhoneValidation(validateBrazilianPhone('5561996975924'));
      }
    }
  }, [dialogOpen, selectedTestPhones]);

  const handleOpenDialog = (template?: WhatsappTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        message: template.message,
        daysBeforeDue: template.daysBeforeDue || 0,
        type: template.type,
        eventType: template.eventType,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        message: '',
        daysBeforeDue: 0,
        type: 'local',
        eventType: 'expiration',
      });
      clearFile();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Preencha nome e mensagem');
      return;
    }

    const variables = extractVariables(formData.message);

    let arquivoData = undefined;
    if (file) {
      const fileInfo = getFileInfo();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      arquivoData = {
        nome: fileInfo?.name || '',
        tipo: fileInfo?.type || '',
        tamanho: fileInfo?.size || 0,
        base64,
      };
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        ...formData,
        variables,
        arquivo: arquivoData,
      });
      toast.success('Template atualizado com sucesso!');
    } else {
      addTemplate({
        ...formData,
        variables,
        arquivo: arquivoData,
      });
      toast.success('Template criado com sucesso!');
    }

    setDialogOpen(false);
    clearFile();
  };

  const handleDelete = () => {
    if (templateToDelete) {
      deleteTemplate(templateToDelete);
      toast.success('Template excluído com sucesso!');
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleReset = () => {
    resetToDefaults();
    toast.success('Templates restaurados para padrão!');
    setResetDialogOpen(false);
  };

  const handleSendTest = async () => {
    if (!formData.message.trim()) {
      toast.error('Preencha a mensagem antes de testar');
      return;
    }

    setIsSendingTest(true);

    try {
      const configStored = localStorage.getItem('whatsapp_config');
      if (!configStored) {
        toast.error('Configure o WhatsApp primeiro em Notificações');
        return;
      }

      const config = JSON.parse(configStored);
      if (!config.appkey || !config.authkey) {
        toast.error('Credenciais WhatsApp não configuradas');
        return;
      }

      // Determinar números para enviar
      const phonesToSend = selectedTestPhones.length > 0 
        ? selectedTestPhones 
        : [config.testPhoneNumber];

      // Preparar mensagem
      const exampleData: Record<string, string> = {
        nome: 'João Silva',
        dataVencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        valor: '49.90',
        linkPagamento: 'https://exemplo.com/pagar/abc123',
        plano: 'Mensal',
        telefone: '(11) 98765-4321',
      };

      let testMessage = formData.message;
      Object.entries(exampleData).forEach(([key, value]) => {
        testMessage = testMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
      testMessage += '\n\n---\n🧪 Esta é uma mensagem de TESTE do sistema IPTV LINK';

      // Enviar para todos os números selecionados
      let successCount = 0;
      let errorCount = 0;

      for (const phone of phonesToSend) {
        try {
          const response = await fetch('https://api.botbot.app/v1/sendmessage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'appkey': config.appkey,
              'authkey': config.authkey,
            },
            body: JSON.stringify({ to: phone, message: testMessage }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
          
          // Pequeno delay entre envios
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`✅ Teste enviado para ${successCount} contato(s)! ${errorCount > 0 ? `(${errorCount} erro(s))` : ''}`);
      } else {
        toast.error('❌ Falha ao enviar testes');
      }
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const getDaysLabel = (days: number | undefined) => {
    if (days === undefined) return '-';
    if (days < 0) return `${Math.abs(days)}d antes`;
    if (days === 0) return 'Dia venc.';
    return `${days}d depois`;
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      expiration: 'Vencimento',
      welcome_trial: 'Boas-vindas Teste',
      welcome_plan: 'Boas-vindas Plano',
      renewal: 'Renovação',
      payment_reminder: 'Lembrete Pgto',
      manual: 'Manual/Automação',
    };
    return labels[eventType] || eventType;
  };

  const getPreviewMessage = () => {
    if (!formData.message) return '';
    
    const exampleData: Record<string, string> = {
      nome: 'João Silva',
      dataVencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      valor: '49.90',
      linkPagamento: 'https://exemplo.com/pagar/abc123',
      plano: 'Mensal',
      telefone: '(11) 98765-4321',
    };
    
    let preview = formData.message;
    Object.entries(exampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      preview = preview.replace(regex, value);
    });
    
    return preview;
  };

  const formatTestPhone = (phone: string) => {
    // Remove DDI 55 se tiver
    const cleaned = phone.replace(/^55/, '');
    // Formato: (XX) XXXXX-XXXX
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    return phone;
  };

  // Verificar templates críticos de boas-vindas
  const welcomeTrialTemplate = templates.find(t => t.eventType === 'welcome_trial');
  const welcomePlanTemplate = templates.find(t => t.eventType === 'welcome_plan');
  const renewalTemplate = templates.find(t => t.eventType === 'renewal');

  const criticalTemplatesStatus = {
    welcome_trial: {
      exists: !!welcomeTrialTemplate,
      template: welcomeTrialTemplate,
      label: 'Boas-vindas - Teste Grátis',
      description: 'Enviado quando um cliente se cadastra para período de teste'
    },
    welcome_plan: {
      exists: !!welcomePlanTemplate,
      template: welcomePlanTemplate,
      label: 'Boas-vindas - Plano Contratado',
      description: 'Enviado quando um cliente contrata um plano pago'
    },
    renewal: {
      exists: !!renewalTemplate,
      template: renewalTemplate,
      label: 'Renovação Confirmada',
      description: 'Enviado quando um cliente renova sua assinatura'
    }
  };

  const missingCriticalTemplates = Object.entries(criticalTemplatesStatus).filter(([_, status]) => !status.exists);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Templates de Mensagens
                </h1>
                {isLive && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium">Ao vivo</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Gerencie os modelos de notificação WhatsApp
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setResetDialogOpen(true)} className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Restaurar Padrão</span>
              <span className="sm:hidden">Restaurar</span>
            </Button>
            <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Template</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        {/* Alerta de Templates Críticos Faltando */}
        {missingCriticalTemplates.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Templates Críticos Não Configurados
              </CardTitle>
              <CardDescription>
                Os seguintes templates são essenciais para o funcionamento do sistema de notificações:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {missingCriticalTemplates.map(([key, status]) => (
                <div key={key} className="flex items-start gap-2 p-3 rounded-lg bg-background border border-border">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{status.label}</p>
                    <p className="text-sm text-muted-foreground">{status.description}</p>
                  </div>
                </div>
              ))}
              <Button
                variant="default"
                onClick={() => {
                  resetToDefaults();
                  toast.success('Templates padrão restaurados com sucesso!');
                }}
                className="mt-4"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar Templates Padrão
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Status dos Templates Críticos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Status dos Templates Críticos
            </CardTitle>
            <CardDescription>
              Verificação dos templates essenciais para boas-vindas e renovações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {Object.entries(criticalTemplatesStatus).map(([key, status]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-start gap-3">
                    {status.exists ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{status.label}</p>
                      <p className="text-sm text-muted-foreground">{status.description}</p>
                      {status.exists && status.template && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Template: {status.template.name}
                        </p>
                      )}
                    </div>
                  </div>
                  {status.exists && status.template && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(status.template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Variáveis Disponíveis</CardTitle>
            <CardDescription>
              Use estas variáveis nas mensagens com chaves duplas, ex: {`{{nome}}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{nome}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{email}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{celular}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{plano}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{valor}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{data_vencimento}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{dias_restantes}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{chave_pix}}`}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="bg-muted px-2 py-1 rounded text-xs sm:text-sm">{`{{link_pagamento}}`}</code>
              </div>
            </div>

            {testPhoneNumber && (
              <div className={`border p-3 rounded-lg ${
                testPhoneValidation.isValid 
                  ? 'bg-blue-500/10 border-blue-500/20' 
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 ${
                    testPhoneValidation.isValid 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {testPhoneValidation.isValid ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {testPhoneValidation.isValid ? (
                        <>Teste: <span className="font-mono">{testPhoneValidation.formatted}</span></>
                      ) : (
                        <>Número inválido: {testPhoneValidation.error}</>
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/admin/notificacoes')}
                    className="text-xs"
                  >
                    {testPhoneValidation.isValid ? 'Alterar' : 'Corrigir'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Templates Cadastrados ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nome</TableHead>
                    <TableHead className="whitespace-nowrap hidden sm:table-cell">Evento</TableHead>
                    <TableHead className="whitespace-nowrap hidden md:table-cell">Dias</TableHead>
                    <TableHead className="whitespace-nowrap hidden lg:table-cell">Mensagem</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum template cadastrado
                    </TableCell>
                  </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium whitespace-nowrap">{template.name}</TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap">
                          <span className="text-xs bg-muted px-2 py-1 rounded">{getEventLabel(template.eventType)}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell whitespace-nowrap">{getDaysLabel(template.daysBeforeDue)}</TableCell>
                        <TableCell className="hidden lg:table-cell max-w-xs truncate">{template.message}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTemplateToDelete(template.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              Configure o modelo de mensagem para notificações automáticas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-2 pointer-events-auto">{/* Conteúdo scrollable */}
            <div>
              <Label htmlFor="name">Nome do Template</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Lembrete 3 dias antes"
              />
            </div>

            <div>
              <Label htmlFor="eventType">Tipo de Evento</Label>
              <Select 
                value={formData.eventType} 
                onValueChange={(value: any) => setFormData({ ...formData, eventType: value })}
              >
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual / Para Automações</SelectItem>
                  <SelectItem value="expiration">Vencimento de Plano</SelectItem>
                  <SelectItem value="welcome_trial">Boas-vindas - Período de Teste</SelectItem>
                  <SelectItem value="welcome_plan">Boas-vindas - Plano Contratado</SelectItem>
                  <SelectItem value="renewal">Renovação Confirmada</SelectItem>
                  <SelectItem value="payment_reminder">Lembrete de Pagamento</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.eventType === 'manual' 
                  ? 'Templates manuais são usados em regras de automação ou envio manual'
                  : 'Quando este template será enviado automaticamente'}
              </p>
            </div>

            {formData.eventType === 'expiration' && (
              <div>
                <Label htmlFor="daysBeforeDue">Dias em relação ao vencimento</Label>
                <Input
                  id="daysBeforeDue"
                  type="number"
                  value={formData.daysBeforeDue}
                  onChange={(e) =>
                    setFormData({ ...formData, daysBeforeDue: parseInt(e.target.value) })
                  }
                  placeholder="0 = dia do vencimento, -3 = 3 dias antes, 5 = 5 dias depois"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valores negativos: antes do vencimento | 0: dia do vencimento | Positivos: após vencimento
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="message">Mensagem</Label>
                <TemplateVariablePicker
                  onInsertVariable={(variable) => {
                    const textarea = document.getElementById('message') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = formData.message;
                      const newText = text.substring(0, start) + variable + text.substring(end);
                      setFormData({ ...formData, message: newText });
                      // Restore cursor position after the inserted text
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + variable.length, start + variable.length);
                      }, 0);
                    } else {
                      setFormData({ ...formData, message: formData.message + variable });
                    }
                  }}
                />
              </div>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Olá {nome}! Seu plano vence em {dataVencimento}..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variáveis com chaves: {`{nome}`}, {`{dataVencimento}`}, {`{valor}`}, {`{linkPagamento}`}
              </p>
            </div>

            <MessageSnippets 
              onInsert={(text) => {
                setFormData({ 
                  ...formData, 
                  message: formData.message + (formData.message ? '\n\n' : '') + text 
                });
              }} 
            />

            {formData.message && (
              <>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Variáveis detectadas:</p>
                  <div className="flex flex-wrap gap-2">
                    {extractVariables(formData.message).map((v) => (
                      <code key={v} className="bg-background px-2 py-1 rounded text-xs">
                        {v}
                      </code>
                    ))}
                  </div>
                </div>

                <TemplatePreview message={formData.message} />

                <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Selecionar destinatários para teste:</p>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin/notificacoes')}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <label className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTestPhones.includes(testPhoneNumber)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTestPhones([...selectedTestPhones, testPhoneNumber]);
                          } else {
                            setSelectedTestPhones(selectedTestPhones.filter(p => p !== testPhoneNumber));
                          }
                        }}
                        className="rounded"
                      />
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Padrão: {formatTestPhone(testPhoneNumber)}</span>
                    </label>
                    
                    {testContacts.map((contact: any) => (
                      <label key={contact.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTestPhones.includes(contact.phone)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTestPhones([...selectedTestPhones, contact.phone]);
                            } else {
                              setSelectedTestPhones(selectedTestPhones.filter(p => p !== contact.phone));
                            }
                          }}
                          className="rounded"
                        />
                        <Users className="h-4 w-4" />
                        <span className="text-sm">{contact.name}: {formatTestPhone(contact.phone)}</span>
                      </label>
                    ))}
                  </div>
                  
                  {selectedTestPhones.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 p-2 rounded">
                      <CheckCircle className="h-3 w-3" />
                      <span>{selectedTestPhones.length} contato(s) selecionado(s)</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="arquivo">Anexar Arquivo (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="arquivo"
                  type="file"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] || null;
                    handleFileSelect(selectedFile);
                  }}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  className="cursor-pointer"
                />
              </div>
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
              {editingTemplate?.arquivo && !file && (
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">{editingTemplate.arquivo.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {(editingTemplate.arquivo.tamanho / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>{/* Fim do conteúdo scrollable */}

          <DialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0 pt-4 border-t">{/* Footer fixo */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={handleSendTest}
                disabled={isSendingTest || !formData.message.trim() || !testPhoneValidation.isValid}
                className="flex-1 sm:flex-none"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSendingTest ? 'Enviando...' : 'Enviar Teste'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin/notificacoes')}
                title="Alterar número de teste nas configurações"
                className="shrink-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1 sm:flex-none">
                {editingTemplate ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Templates Padrão</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá substituir todos os templates atuais pelos templates padrão do sistema.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
