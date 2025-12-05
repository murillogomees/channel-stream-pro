import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Server, HardDrive, Zap, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

interface SecretField {
  value: string;
  masked: string;
  configured: boolean;
}

interface R2Config {
  accountId: SecretField;
  accessKeyId: SecretField;
  secretAccessKey: SecretField;
  bucketName: SecretField;
  publicDomain: SecretField;
}

export function CDNConfigPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingSecrets, setLoadingSecrets] = useState(true);
  const [testing, setTesting] = useState(false);
  
  // Visibilidade dos campos
  const [showAccountId, setShowAccountId] = useState(false);
  const [showAccessKeyId, setShowAccessKeyId] = useState(false);
  const [showSecretAccessKey, setShowSecretAccessKey] = useState(false);
  
  // Valores dos secrets carregados
  const [r2Secrets, setR2Secrets] = useState<R2Config | null>(null);
  
  // Config editável
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
    loadSecrets();
  }, []);

  const loadSecrets = async () => {
    setLoadingSecrets(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-r2-config');
      
      if (error) throw error;
      
      if (data?.success && data.config) {
        setR2Secrets(data.config);
        
        // Preencher config com valores reais se existirem
        setConfig(prev => ({
          ...prev,
          r2AccountId: data.config.accountId.value || prev.r2AccountId,
          r2AccessKeyId: data.config.accessKeyId.value || prev.r2AccessKeyId,
          r2SecretAccessKey: data.config.secretAccessKey.value || prev.r2SecretAccessKey,
          r2BucketName: data.config.bucketName.value || prev.r2BucketName,
        }));
      }
    } catch (error: any) {
      console.error('Error loading secrets:', error);
    } finally {
      setLoadingSecrets(false);
    }
  };

  const loadConfig = async () => {
    try {
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
        }, { onConflict: 'config_key' });

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

  // Componente de input com máscara e toggle
  const SecretInput = ({ 
    label, 
    value, 
    onChange, 
    secretField, 
    show, 
    onToggle,
    placeholder 
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    secretField?: SecretField;
    show: boolean;
    onToggle: () => void;
    placeholder: string;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {secretField?.configured && (
          <Badge variant="secondary" className="text-xs">Configurado</Badge>
        )}
      </Label>
      <div className="relative">
        <Input
          value={show ? value : (secretField?.masked || value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={show ? 'text' : 'password'}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={onToggle}
        >
          {show ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );

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
              {loadingSecrets && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
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

              <SecretInput
                label="Account ID"
                value={config.r2AccountId}
                onChange={(value) => setConfig({ ...config, r2AccountId: value })}
                secretField={r2Secrets?.accountId}
                show={showAccountId}
                onToggle={() => setShowAccountId(!showAccountId)}
                placeholder="account-id"
              />

              <SecretInput
                label="Access Key ID"
                value={config.r2AccessKeyId}
                onChange={(value) => setConfig({ ...config, r2AccessKeyId: value })}
                secretField={r2Secrets?.accessKeyId}
                show={showAccessKeyId}
                onToggle={() => setShowAccessKeyId(!showAccessKeyId)}
                placeholder="access-key"
              />

              <SecretInput
                label="Secret Access Key"
                value={config.r2SecretAccessKey}
                onChange={(value) => setConfig({ ...config, r2SecretAccessKey: value })}
                secretField={r2Secrets?.secretAccessKey}
                show={showSecretAccessKey}
                onToggle={() => setShowSecretAccessKey(!showSecretAccessKey)}
                placeholder="secret-key"
              />
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
