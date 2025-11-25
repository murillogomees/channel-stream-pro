import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppService } from '@/services/whatsapp';
import { AlertCircle, CheckCircle2, Loader2, Key, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminWhatsAppConfig() {
  const { toast } = useToast();
  const [appkey, setAppkey] = useState('');
  const [authkey, setAuthkey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    // Carregar configurações existentes
    const configStr = localStorage.getItem('whatsapp_config');
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        setAppkey(config.appkey || '');
        setAuthkey(config.authkey || '');
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    }
  }, []);

  const handleSave = () => {
    if (!WhatsAppService.validateCredentials(appkey, authkey)) {
      toast({
        title: 'Credenciais inválidas',
        description: 'Por favor, preencha ambos os campos',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const config = { appkey, authkey };
      localStorage.setItem('whatsapp_config', JSON.stringify(config));

      toast({
        title: '✅ Configurações salvas',
        description: 'As credenciais do BotBot foram salvas com sucesso',
      });

      setVerificationStatus(null);
    } catch (error) {
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
    if (!WhatsAppService.validateCredentials(appkey, authkey)) {
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
          description: 'As credenciais BotBot estão funcionando corretamente',
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Configuração BotBot WhatsApp
          </CardTitle>
          <CardDescription>
            Configure suas credenciais da API BotBot para envio de mensagens WhatsApp
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
              placeholder="Digite seu AppKey do BotBot"
              value={appkey}
              onChange={(e) => setAppkey(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Chave de aplicação fornecida pelo BotBot
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
              placeholder="Digite seu AuthKey do BotBot"
              value={authkey}
              onChange={(e) => setAuthkey(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Chave de autenticação fornecida pelo BotBot
            </p>
          </div>

          {/* Informações de Ajuda */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Como obter suas credenciais:</strong>
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
                <li>Acesse o painel do BotBot em botbot.chat</li>
                <li>Faça login na sua conta</li>
                <li>Vá em Configurações ou API</li>
                <li>Copie seu AppKey e AuthKey</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Botões de Ação */}
          <div className="flex gap-3">
            <Button
              onClick={handleVerify}
              variant="outline"
              disabled={isVerifying || isLoading}
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
              disabled={isLoading || isVerifying}
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
          </div>
        </CardContent>
      </Card>

      {/* Card de Funcionalidades */}
      <Card>
        <CardHeader>
          <CardTitle>Funcionalidades Disponíveis</CardTitle>
          <CardDescription>
            O que você pode fazer com a integração BotBot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Envio automático de mensagens de boas-vindas para novos clientes</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Notificações de vencimento de plano</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Alertas para administradores sobre novos cadastros</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Mensagens personalizadas com templates</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Envio de arquivos e imagens</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
