import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Server, HardDrive, Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export function CDNConfigPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    r2BucketName: 'iptvlink-cdn',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    cdnEnabled: true,
    autoDownloadEnabled: false,
    maxConcurrentDownloads: 10,
    retryAttempts: 5,
    downloadTimeout: 60000,
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Carregar configuração atual do banco
      const { data, error } = await supabase
        .from('content_routing_config')
        .select('*')
        .eq('config_key', 'cdn_settings')
        .maybeSingle();

      if (error) throw error;

      if (data?.config_value && typeof data.config_value === 'object') {
        setConfig(prev => ({
          ...prev,
          ...(data.config_value as Record<string, any>)
        }));
      }
    } catch (error: any) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('content_routing_config')
        .upsert({
          config_key: 'cdn_settings',
          config_value: config,
          description: 'Configurações do CDN R2 e sistema de download',
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'Configuração salva',
        description: 'CDN configurado com sucesso',
      });

    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Testar conexão com R2
      const { data, error } = await supabase.functions.invoke('test-r2-connection', {
        body: {
          accountId: config.r2AccountId,
          accessKeyId: config.r2AccessKeyId,
          secretAccessKey: config.r2SecretAccessKey,
          bucketName: config.r2BucketName
        }
      });

      if (error) throw error;

      if (data.success) {
        setTestResult({
          success: true,
          message: `Conexão bem-sucedida! Bucket: ${config.r2BucketName}`
        });
        toast({
          title: 'Teste bem-sucedido',
          description: 'Conexão com R2 funcionando corretamente',
        });
      } else {
        throw new Error(data.error || 'Falha na conexão');
      }

    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Falha: ${error.message}`
      });
      toast({
        title: 'Erro na conexão',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const triggerBulkDownload = async () => {
    try {
      toast({
        title: 'Download iniciado',
        description: 'Processando conteúdo em background...',
      });

      const { error } = await supabase.functions.invoke('cdn-bulk-downloader', {
        body: { maxChannels: 50 }
      });

      if (error) throw error;

      toast({
        title: 'Download em progresso',
        description: 'Acompanhe o progresso no painel de monitoramento',
      });

    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar download',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Configuração do CDN
          </CardTitle>
          <CardDescription>
            Configure o Cloudflare R2 e sistema de download de conteúdo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configurações do R2 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              <h3 className="text-sm font-medium">Cloudflare R2</h3>
              <Badge variant="outline">iptvlink-cdn</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bucket Name</Label>
                <Input
                  value={config.r2BucketName}
                  onChange={(e) => setConfig({ ...config, r2BucketName: e.target.value })}
                  placeholder="iptvlink-cdn"
                  disabled
                />
                <p className="text-xs text-muted-foreground">Nome fixo do bucket</p>
              </div>

              <div className="space-y-2">
                <Label>Account ID</Label>
                <Input
                  value={config.r2AccountId}
                  onChange={(e) => setConfig({ ...config, r2AccountId: e.target.value })}
                  placeholder="account-id"
                  type="password"
                />
              </div>

              <div className="space-y-2">
                <Label>Access Key ID</Label>
                <Input
                  value={config.r2AccessKeyId}
                  onChange={(e) => setConfig({ ...config, r2AccessKeyId: e.target.value })}
                  placeholder="access-key"
                  type="password"
                />
              </div>

              <div className="space-y-2">
                <Label>Secret Access Key</Label>
                <Input
                  value={config.r2SecretAccessKey}
                  onChange={(e) => setConfig({ ...config, r2SecretAccessKey: e.target.value })}
                  placeholder="secret-key"
                  type="password"
                />
              </div>
            </div>

            {/* Teste de Conexão */}
            <div className="flex items-center gap-2">
              <Button onClick={testConnection} disabled={testing} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
                Testar Conexão
              </Button>
              {testResult && (
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Configurações de Download */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <h3 className="text-sm font-medium">Sistema de Download</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>CDN Habilitado</Label>
                  <p className="text-xs text-muted-foreground">Usar R2 para entrega de conteúdo</p>
                </div>
                <Switch
                  checked={config.cdnEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, cdnEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Download Automático</Label>
                  <p className="text-xs text-muted-foreground">Baixar conteúdo novo automaticamente</p>
                </div>
                <Switch
                  checked={config.autoDownloadEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, autoDownloadEnabled: checked })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Downloads Simultâneos</Label>
                  <Input
                    type="number"
                    value={config.maxConcurrentDownloads}
                    onChange={(e) => setConfig({ ...config, maxConcurrentDownloads: parseInt(e.target.value) })}
                    min="1"
                    max="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tentativas de Retry</Label>
                  <Input
                    type="number"
                    value={config.retryAttempts}
                    onChange={(e) => setConfig({ ...config, retryAttempts: parseInt(e.target.value) })}
                    min="1"
                    max="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={config.downloadTimeout}
                    onChange={(e) => setConfig({ ...config, downloadTimeout: parseInt(e.target.value) })}
                    min="10000"
                    step="10000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={saveConfig} disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
            <Button onClick={triggerBulkDownload} variant="outline">
              <Zap className="h-4 w-4 mr-2" />
              Download em Massa
            </Button>
          </div>

          {/* Aviso */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Nova Lógica:</strong> Todo conteúdo é tratado como estático (VOD) por padrão e vai para o R2 CDN. 
              Apenas conteúdo com URL /live/ ou explicitamente marcado como "TV ao vivo" usa Cloudflare Stream.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
