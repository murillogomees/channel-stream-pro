import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWhatsAppConfig } from '@/hooks/useWhatsAppConfig';
import { WhatsAppService } from '@/services/whatsapp';
import { AlertCircle, CheckCircle2, Loader2, Key, Shield, MessageSquare, Send } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function AdminWhatsAppConfig() {
  const { toast } = useToast();
  const { config, loading: configLoading, saveConfig } = useWhatsAppConfig();
  const [appkey, setAppkey] = useState('');
  const [authkey, setAuthkey] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!configLoading) {
      setAppkey(config.appkey || '');
      setAuthkey(config.authkey || '');
      setTestPhone(config.testPhoneNumber || '');
    }
  }, [config, configLoading]);

  const handleSave = async () => {
    if (!appkey || !authkey) {
      toast({
        title: 'Credenciais inválidas',
        description: 'Por favor, preencha ambos os campos',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await saveConfig({ 
        appkey, 
        authkey,
        testPhoneNumber: testPhone 
      });

      toast({
        title: '✅ Configurações salvas',
        description: 'As credenciais do WhatsApp foram salvas com sucesso',
      });

      setVerificationStatus(null);
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!appkey || !authkey) {
      toast({
        title: 'Credenciais inválidas',
        description: 'Por favor, preencha ambos os campos antes de verificar',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    setVerificationStatus(null);

    try {
      const service = new WhatsAppService(appkey, authkey);
      const result = await service.verifyCredentials();

      setVerificationStatus(result);

      if (result.valid) {
        toast({
          title: '✅ Credenciais válidas',
          description: 'As credenciais WhatsApp estão funcionando corretamente',
        });
      } else {
        toast({
          title: '❌ Credenciais inválidas',
          description: result.error || 'Erro ao verificar credenciais',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao verificar:', error);
      toast({
        title: 'Erro na verificação',
        description: 'Não foi possível verificar as credenciais',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) {
      toast({
        title: 'Telefone não informado',
        description: 'Digite um número de telefone para teste',
        variant: 'destructive',
      });
      return;
    }

    if (!config.appkey || !config.authkey) {
      toast({
        title: 'Configure primeiro',
        description: 'Salve as credenciais antes de testar',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);

    try {
      const service = new WhatsAppService(config.appkey, config.authkey);
      await service.sendTextMessage(
        testPhone,
        '🎉 *Teste de Configuração WhatsApp*\n\nSua integração WhatsApp está funcionando perfeitamente!\n\nVocê pode começar a enviar notificações automáticas para seus clientes.'
      );

      toast({
        title: '✅ Mensagem enviada!',
        description: `Mensagem de teste enviada para ${testPhone}`,
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro ao enviar',
        description: error.message || 'Não foi possível enviar a mensagem de teste',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConfiguredViaSecrets = config.appkey === 'CONFIGURED_VIA_SECRETS' || 
    (!config.appkey && config.enabled);

  return (
    <div className="space-y-6">
      {/* Secrets Status Alert */}
      {isConfiguredViaSecrets && (
        <Alert className="bg-green-500/10 border-green-500/30">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <strong>Credenciais Configuradas via Supabase Secrets</strong>
            <br />
            As chaves WHATSAPP_APPKEY e WHATSAPP_AUTHKEY estão configuradas com segurança nos Secrets do projeto.
            As edge functions usam automaticamente esses valores.
          </AlertDescription>
        </Alert>
      )}

      {/* Credentials Card */}
      <Card className="border-integration-messaging/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-integration-messaging-bg">
                  <Shield className="h-5 w-5 text-integration-messaging" />
                </div>
                Credenciais WhatsApp API
              </CardTitle>
              {config.enabled || isConfiguredViaSecrets ? (
                <Badge className="bg-success/20 text-success border-success/30">Configurado</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Não Configurado</Badge>
              )}
            </div>
            <CardDescription className="mt-2">
              {isConfiguredViaSecrets 
                ? "Credenciais gerenciadas via Supabase Secrets (WHATSAPP_APPKEY, WHATSAPP_AUTHKEY)"
                : "Configure suas credenciais da API WhatsApp para envio automático de mensagens"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status de Verificação */}
            {verificationStatus && (
              <Alert variant={verificationStatus.valid ? 'default' : 'destructive'}>
                {verificationStatus.valid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {verificationStatus.valid
                    ? 'Credenciais verificadas e funcionando corretamente'
                    : verificationStatus.error || 'Credenciais inválidas'}
                </AlertDescription>
              </Alert>
            )}

            {/* Campo AppKey */}
            <div className="space-y-2">
              <Label htmlFor="appkey" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                AppKey
              </Label>
              <Input
                id="appkey"
                type="password"
                placeholder="Digite seu AppKey"
                value={appkey}
                onChange={(e) => setAppkey(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Chave de aplicação fornecida pela API WhatsApp
              </p>
            </div>

            {/* Campo AuthKey */}
            <div className="space-y-2">
              <Label htmlFor="authkey" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                AuthKey
              </Label>
              <Input
                id="authkey"
                type="password"
                placeholder="Digite seu AuthKey"
                value={authkey}
                onChange={(e) => setAuthkey(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Chave de autenticação fornecida pela API WhatsApp
              </p>
            </div>

            {/* Telefone de Teste */}
            <div className="space-y-2">
              <Label htmlFor="testPhone" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Telefone para Teste
              </Label>
              <Input
                id="testPhone"
                type="tel"
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Digite um número com DDD e 9 dígitos (apenas números)
              </p>
            </div>

            {/* Informações de Ajuda */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Como obter suas credenciais:</strong>
                <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
                  <li>Entre em contato com seu provedor de API WhatsApp</li>
                  <li>Solicite as credenciais AppKey e AuthKey</li>
                  <li>Cole as credenciais nos campos acima</li>
                  <li>Clique em "Verificar" para testar a conexão</li>
                  <li>Salve as configurações</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleVerify}
                variant="outline"
                disabled={isVerifying || isLoading || !appkey || !authkey}
                className="flex-1"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Verificar Credenciais
                  </>
                )}
              </Button>

              <Button
                onClick={handleSave}
                disabled={isLoading || isVerifying || !appkey || !authkey}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Configurações'
                )}
              </Button>

              <Button
                onClick={handleTestMessage}
                variant="secondary"
                disabled={isTesting || isLoading || !testPhone || !config.enabled}
                className="flex-1"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Enviar Teste
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card de Funcionalidades */}
        <Card className="border-integration-messaging/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-integration-messaging" />
              Funcionalidades Disponíveis
            </CardTitle>
            <CardDescription>
              O que você pode fazer com a integração WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Envio automático de mensagens de boas-vindas para novos clientes</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Notificações de vencimento de plano (automáticas)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Alertas para administradores sobre novos cadastros</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Mensagens personalizadas com templates</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Envio de arquivos e imagens para clientes</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm">Sistema de retry automático para mensagens falhadas</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Card de Status */}
        <Card className="border-integration-messaging/20">
          <CardHeader>
            <CardTitle>Status da Configuração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Status:</span>
                {config.enabled ? (
                  <Badge className="bg-success/20 text-success border-success/30">Configurado</Badge>
                ) : (
                  <Badge variant="secondary">Não Configurado</Badge>
                )}
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Notificações Automáticas:</span>
                {config.autoSendEnabled ? (
                  <Badge className="bg-info/20 text-info border-info/30">Ativadas</Badge>
                ) : (
                  <Badge variant="outline">Desativadas</Badge>
                )}
              </div>
              {config.autoSendEnabled && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Horário de Envio:</span>
                  <Badge variant="outline">{config.sendHour}:00</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
