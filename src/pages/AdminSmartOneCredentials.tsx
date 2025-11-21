import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Key, Globe, Shield, Clock, Activity } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ValidationResult {
  success: boolean;
  validation?: {
    credentials_configured: boolean;
    api_base_url: { configured: boolean; value: string | null; masked: boolean };
    client_api: { configured: boolean; value: string | null; length: number; masked: boolean };
    key_api: { configured: boolean; value: string | null; length: number; masked: boolean };
  };
  tests?: Array<{
    method: string;
    endpoint?: string;
    status?: number;
    success: boolean;
    latency_ms?: number;
    cloudflare_blocked?: boolean;
    is_json?: boolean;
    is_html?: boolean;
    error?: string;
    response_preview?: string;
  }>;
  diagnosis?: {
    overall_status: string;
    credentials_valid: boolean;
    api_accessible: boolean;
    cloudflare_blocking: boolean;
    working_methods: string[];
    recommendation: string;
  };
  error?: string;
  latency_ms?: number;
}

export default function AdminSmartOneCredentials() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const validateCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-smartone-credentials');

      if (error) {
        toast({
          title: "Erro ao validar credenciais",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setResult(data);

      if (data.success) {
        toast({
          title: "✅ Validação concluída",
          description: data.diagnosis?.recommendation || "Credenciais validadas com sucesso",
          duration: 8000,
        });
      } else {
        toast({
          title: "❌ Validação falhou",
          description: data.error || data.diagnosis?.recommendation || "Erro ao validar credenciais",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testXtreamApi = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smartone-xtream-api', {
        body: { action: 'user_info' }
      });

      if (error) {
        toast({
          title: "Erro ao testar API Xtream",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        toast({
          title: "✅ API Xtream Codes funcionando!",
          description: `Conectado com sucesso. Latência: ${data.latency_ms}ms`,
          duration: 8000,
        });
        console.log('User Info:', data.user_info);
        console.log('Server Info:', data.server_info);
      } else {
        toast({
          title: "❌ API Xtream falhou",
          description: data.error || "Erro ao acessar API",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (success: boolean | undefined) => {
    if (success === true) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (success === false) return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'partial':
        return <Badge variant="secondary">Parcial</Badge>;
      case 'success':
        return <Badge className="bg-green-500">Sucesso</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Validação de Credenciais SmartOne
          </CardTitle>
          <CardDescription>
            Verifique se as credenciais da API SmartOne estão configuradas corretamente e funcionando
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Execute os testes para verificar a conectividade e autenticação com a API SmartOne
            </p>
            <div className="flex gap-2">
              <Button onClick={validateCredentials} disabled={loading} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Validando...' : 'Validar Credenciais'}
              </Button>
              <Button onClick={testXtreamApi} disabled={loading}>
                <Activity className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Testando...' : 'Testar API Xtream Codes'}
              </Button>
            </div>
          </div>

          {result && (
            <div className="space-y-4 mt-6">
              {/* Status Geral */}
              {result.diagnosis && (
                <Alert variant={result.diagnosis.overall_status === 'failed' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center gap-2">
                    Status Geral: {getStatusBadge(result.diagnosis.overall_status)}
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    {result.diagnosis.recommendation}
                  </AlertDescription>
                </Alert>
              )}

              {/* Configuração das Credenciais */}
              {result.validation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Configuração das Credenciais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">API Base URL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.validation.api_base_url.configured)}
                        {result.validation.api_base_url.configured && (
                          <code className="text-xs bg-background px-2 py-1 rounded">
                            {result.validation.api_base_url.value}
                          </code>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Client API Key</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.validation.client_api.configured)}
                        {result.validation.client_api.configured && (
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded">
                              {result.validation.client_api.value}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {result.validation.client_api.length} chars
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Key API</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.validation.key_api.configured)}
                        {result.validation.key_api.configured && (
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded">
                              {result.validation.key_api.value}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {result.validation.key_api.length} chars
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resultados dos Testes */}
              {result.tests && result.tests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Testes de Conectividade
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.tests.map((test, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${
                            test.success
                              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(test.success)}
                              <span className="font-medium text-sm">{test.method}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {test.status && (
                                <Badge variant="outline" className="text-xs">
                                  HTTP {test.status}
                                </Badge>
                              )}
                              {test.latency_ms && (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {test.latency_ms}ms
                                </Badge>
                              )}
                            </div>
                          </div>

                          {test.endpoint && (
                            <code className="text-xs text-muted-foreground block mb-2 truncate">
                              {test.endpoint}
                            </code>
                          )}

                          {test.cloudflare_blocked && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTriangle className="h-3 w-3" />
                              <AlertDescription className="text-xs">
                                Bloqueado pelo Cloudflare (proteção anti-bot)
                              </AlertDescription>
                            </Alert>
                          )}

                          {test.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Erro: {test.error}
                            </p>
                          )}

                          {test.response_preview && !test.success && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                                Ver prévia da resposta
                              </summary>
                              <pre className="text-xs mt-2 p-2 bg-background rounded overflow-auto max-h-32">
                                {test.response_preview}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Diagnóstico Detalhado */}
              {result.diagnosis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Diagnóstico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Credenciais Válidas</p>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.diagnosis.credentials_valid)}
                          <span className="font-medium text-sm">
                            {result.diagnosis.credentials_valid ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">API Acessível</p>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.diagnosis.api_accessible)}
                          <span className="font-medium text-sm">
                            {result.diagnosis.api_accessible ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Bloqueio Cloudflare</p>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(!result.diagnosis.cloudflare_blocking)}
                          <span className="font-medium text-sm">
                            {result.diagnosis.cloudflare_blocking ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Métodos Funcionando</p>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {result.diagnosis.working_methods.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {result.diagnosis.working_methods.length > 0 && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                        <p className="text-xs text-green-900 dark:text-green-100 font-medium mb-2">
                          Métodos HTTP que funcionaram:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {result.diagnosis.working_methods.map((method, index) => (
                            <Badge key={index} className="bg-green-500 text-xs">
                              {method}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Informações de Performance */}
              {result.latency_ms && (
                <div className="text-xs text-muted-foreground text-right">
                  Tempo total de validação: {result.latency_ms}ms
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
