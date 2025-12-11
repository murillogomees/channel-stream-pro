import { useState, useEffect } from 'react';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { useAutoNotifications } from '@/hooks/useAutoNotifications';
import { validateBrazilianPhone } from '@/utils/phoneValidator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Play, Clock, AlertCircle, CheckCircle, Settings, Activity } from 'lucide-react';
import { getWhatsAppService } from '@/services/whatsapp';

export default function AdminNotificationSettings() {
  const { toast } = useToast();
  const { config, loading: configLoading, saveConfig } = useWhatsAppConfig();
  const isConfigured = config.appkey.length > 0 && config.authkey.length > 0;
  const { stats, loading: statsLoading } = useNotificationLogs();
  const { forceRun, getNextRunTime } = useAutoNotifications();
  const [runningManual, setRunningManual] = useState(false);
  const [testingCredentials, setTestingCredentials] = useState(false);
  const [phoneValidation, setPhoneValidation] = useState<{
    isValid: boolean;
    error?: string;
    formatted?: string;
  }>({ isValid: true });

  const nextRunTime = getNextRunTime();

  useEffect(() => {
    if (config.testPhoneNumber) {
      const validation = validateBrazilianPhone(config.testPhoneNumber);
      setPhoneValidation(validation);
    } else {
      setPhoneValidation({ isValid: true });
    }
  }, [config.testPhoneNumber]);

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

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Monitoramento do envio automático de notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Sistema WhatsApp:</span>
                <Badge variant={isConfigured ? 'default' : 'secondary'}>
                  {isConfigured ? '🟢 Conectado' : '⚫ Não Configurado'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Envio Automático:</span>
                <Badge variant={config.autoSendEnabled ? 'default' : 'secondary'}>
                  {config.autoSendEnabled ? '🟢 Ativo' : '⚫ Desativado'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Horário Configurado:</span>
                <span className="text-sm font-medium">{config.sendHour}:00h</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Último Envio:</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {!statsLoading && stats.lastSentAt
                    ? stats.lastSentAt.toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Nenhum'}
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

          {!statsLoading && stats.total24h > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Total (24h)</p>
                <p className="text-2xl font-bold text-blue-500">{stats.total24h}</p>
              </div>
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Sucesso (24h)</p>
                <p className="text-2xl font-bold text-green-500">{stats.success24h}</p>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Erros (24h)</p>
                <p className="text-2xl font-bold text-red-500">{stats.errors24h}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleForceRun} 
              variant="outline" 
              className="flex-1"
              disabled={!isConfigured || runningManual}
            >
              <Play className="mr-2 h-4 w-4" />
              {runningManual ? 'Executando...' : '🔄 Executar Agora (Teste)'}
            </Button>
            <Button
              onClick={handleTestCredentials}
              variant="outline"
              disabled={!isConfigured || testingCredentials}
            >
              {testingCredentials ? 'Testando...' : 'Testar Credenciais'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Envio
          </CardTitle>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    const value = e.target.value.replace(/\D/g, '');
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
                Corrija o formato do número para enviar mensagens de teste
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
