import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Settings, Copy, Webhook, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { smartoneService } from '@/services/smartoneService';
import { webhookService } from '@/services/webhookService';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminSmartOneConfig() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  
  const [enabled, setEnabled] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');
  const [clientApi, setClientApi] = useState('');
  const [keyApi, setKeyApi] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const webhookUrl = webhookService.getWebhookUrl();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
      return;
    }

    loadConfig();
  }, [authLoading, isAdmin, navigate]);

  const loadConfig = async () => {
    try {
      const config = await smartoneService.getConfig();
      setEnabled(config.enabled);
      setBaseUrl(config.baseUrl);
      setClientApi(config.clientApi);
      setKeyApi(config.keyApi);
      setConfigLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: 'Erro ao carregar configuração',
        description: 'Não foi possível carregar as configurações do SmartOne.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);

    try {
      await smartoneService.updateConfig({
        enabled,
        baseUrl: baseUrl.trim(),
        clientApi: clientApi.trim(),
        keyApi: keyApi.trim(),
      });

      toast({
        title: 'Configurações salvas',
        description: 'As configurações do SmartOne foram salvas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!baseUrl || !clientApi || !keyApi) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha URL base, Client API e Key API para testar.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Tentar fazer uma requisição de teste para a API do SmartOne
      const response = await fetch(`${baseUrl.trim()}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTestResult({
          success: true,
          message: 'Conexão estabelecida com sucesso! A API SmartOne está respondendo.',
        });
      } else {
        setTestResult({
          success: false,
          message: `Erro na conexão: Status ${response.status}. Verifique a URL e credenciais.`,
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Erro ao conectar: ${error.message}. Verifique se a URL está correta e acessível.`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast({
        title: 'URL copiada!',
        description: 'A URL do webhook foi copiada para a área de transferência.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar a URL. Tente manualmente.',
        variant: 'destructive',
      });
    }
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const result = await webhookService.testWebhook();
      setWebhookTestResult(result);
      
      if (result.success) {
        toast({
          title: 'Webhook testado com sucesso',
          description: result.message,
        });
      } else {
        toast({
          title: 'Erro no teste do webhook',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setWebhookTestResult({
        success: false,
        message: `Erro ao testar webhook: ${error.message}`,
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  if (authLoading || !configLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-lg text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              Configurações SmartOne IPTV
            </h1>
          </div>
        </div>

        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sobre a Integração SmartOne
          </AlertTitle>
          <AlertDescription>
            Configure a integração automática com a API do SmartOne IPTV. Quando habilitada, 
            o sistema criará automaticamente playlists no SmartOne sempre que um cliente 
            for cadastrado com MAC, usuário e senha.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Status da Integração</CardTitle>
            <CardDescription>
              Habilite ou desabilite a integração com SmartOne IPTV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex-1">
                <Label htmlFor="enabled" className="text-base font-semibold cursor-pointer">
                  Integração SmartOne
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {enabled 
                    ? 'Integração ativa - playlists serão criadas automaticamente'
                    : 'Integração desativada - nenhuma playlist será criada'
                  }
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={enabled ? "default" : "secondary"} className={enabled ? "bg-green-600" : "bg-gray-500"}>
                  {enabled ? 'Ativo' : 'Inativo'}
                </Badge>
                <Switch
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credenciais da API</CardTitle>
            <CardDescription>
              Configure as credenciais para conectar com a API do SmartOne IPTV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL Base da API *</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.smartoneiptv.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL completa da API do SmartOne (ex: https://api.smartoneiptv.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientApi">Client API *</Label>
              <Input
                id="clientApi"
                type="text"
                placeholder="seu_client_api"
                value={clientApi}
                onChange={(e) => setClientApi(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Identificador do cliente fornecido pelo SmartOne
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyApi">Key API *</Label>
              <Input
                id="keyApi"
                type="password"
                placeholder="sua_key_api"
                value={keyApi}
                onChange={(e) => setKeyApi(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Chave de autenticação fornecida pelo SmartOne
              </p>
            </div>
          </CardContent>
        </Card>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              )}
              <div>
                <AlertTitle>
                  {testResult.success ? 'Teste bem-sucedido' : 'Falha no teste'}
                </AlertTitle>
                <AlertDescription>{testResult.message}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !baseUrl || !clientApi || !keyApi}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Testar Conexão
              </>
            )}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="sm:min-w-[200px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  Webhook de Notificações
                </CardTitle>
                <CardDescription className="mt-2">
                  Configure o SmartOne para enviar notificações sobre mudanças de status
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Automático
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle className="flex items-center gap-2 text-sm">
                <Webhook className="h-4 w-4" />
                URL do Webhook
              </AlertTitle>
              <AlertDescription className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Configure esta URL no painel do SmartOne IPTV para receber notificações automáticas 
                  sobre criação, atualização e erros de playlists.
                </p>
                <div className="flex gap-2 mt-3">
                  <Input
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-xs bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhookUrl}
                    title="Copiar URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            {webhookTestResult && (
              <Alert variant={webhookTestResult.success ? "default" : "destructive"}>
                <div className="flex items-start gap-2">
                  {webhookTestResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div>
                    <AlertTitle>
                      {webhookTestResult.success ? 'Webhook funcionando' : 'Erro no webhook'}
                    </AlertTitle>
                    <AlertDescription>{webhookTestResult.message}</AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            <Button
              variant="outline"
              onClick={handleTestWebhook}
              disabled={isTestingWebhook}
              className="w-full sm:w-auto"
            >
              {isTestingWebhook ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando Webhook...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Testar Webhook
                </>
              )}
            </Button>

            <div className="space-y-2 pt-4 border-t">
              <h4 className="text-sm font-semibold">Eventos Suportados</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant="default" className="bg-green-600">✓</Badge>
                  <span><strong>playlist.created</strong> - Playlist criada</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant="default" className="bg-blue-600">↻</Badge>
                  <span><strong>playlist.updated</strong> - Playlist atualizada</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant="destructive">✗</Badge>
                  <span><strong>playlist.error</strong> - Erro na playlist</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant="secondary">🗑</Badge>
                  <span><strong>playlist.deleted</strong> - Playlist removida</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h4 className="text-sm font-semibold">Formato do Payload</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`{
  "event": "playlist.created",
  "playlist_id": "abc123",
  "mac": "00:11:22:33:44:55",
  "status": "active",
  "created_at": "2024-01-01T12:00:00Z",
  "metadata": {
    "m3u_url": "http://..."
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Como funciona?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span className="font-semibold text-primary">1.</span>
              <p>
                Quando um cliente é cadastrado com <strong>MAC</strong>, <strong>Usuário</strong> e <strong>Senha</strong>, 
                o sistema chama automaticamente a API do SmartOne.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-primary">2.</span>
              <p>
                A playlist M3U é construída usando o formato: 
                <code className="bg-muted px-1 rounded text-xs ml-1">
                  http://dns.fastcdn.fun:80/get.php?username=XXX&password=XXX&type=m3u_plus&output=ts
                </code>
              </p>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-primary">3.</span>
              <p>
                O status da sincronização é exibido na lista de clientes com badges: 
                <strong>Criado</strong>, <strong>Pendente</strong>, <strong>Erro</strong> ou <strong>Não enviado</strong>.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-primary">4.</span>
              <p>
                Se a integração estiver <strong>desabilitada</strong>, nenhuma chamada à API será feita, 
                mesmo que o cliente tenha todos os dados necessários.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
