import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Wifi, 
  WifiOff,
  Activity,
  AlertTriangle,
  PlayCircle
} from "lucide-react";
import { validateMacAddress, normalizeMacAddress } from "@/services/smartoneService";

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  latency?: number;
  details?: any;
}

const AdminSmartOneTest = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'success' | 'error' | 'warning'>('idle');
  
  // Playlist creation test states
  const [testingPlaylist, setTestingPlaylist] = useState(false);
  const [playlistTestResult, setPlaylistTestResult] = useState<any>(null);
  const [playlistForm, setPlaylistForm] = useState({
    nome: '',
    mac: '',
    m3uUrl: ''
  });

  if (!authLoading && !isAdmin) {
    navigate('/auth');
    return null;
  }

  const runConnectivityTest = async () => {
    setTesting(true);
    setTestResults([]);
    setOverallStatus('idle');
    const results: TestResult[] = [];

    try {
      // Teste 1: Validar sessão ativa
      const startSessionTest = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        results.push({
          test: 'Sessão Ativa',
          status: 'success',
          message: 'Sessão de autenticação válida',
          latency: Date.now() - startSessionTest,
        });
      } else {
        results.push({
          test: 'Sessão Ativa',
          status: 'error',
          message: 'Nenhuma sessão ativa encontrada',
          latency: Date.now() - startSessionTest,
        });
      }

      // Teste 2: Healthcheck SmartOne API
      const startConnTest = Date.now();
      try {
        // Obter o token de autenticação da sessão atual
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          results.push({
            test: 'Conectividade API',
            status: 'error',
            message: 'Sessão de autenticação não encontrada',
            latency: Date.now() - startConnTest,
          });
        } else {
          const { data, error } = await supabase.functions.invoke('smartone-test', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          const latency = Date.now() - startConnTest;

          if (error) {
            results.push({
              test: 'Conectividade API',
              status: 'error',
              message: `Erro ao conectar: ${error.message}`,
              latency,
              details: error,
            });
          } else if (data?.success) {
            results.push({
              test: 'Conectividade API',
              status: 'success',
              message: `Healthcheck OK - SmartOne ${data.smartone_status}`,
              latency,
              details: data,
            });
          } else {
            results.push({
              test: 'Conectividade API',
              status: 'warning',
              message: data?.error || 'API retornou erro',
              latency,
              details: data,
            });
          }
        }
      } catch (error: any) {
        results.push({
          test: 'Conectividade API',
          status: 'error',
          message: `Falha na conexão: ${error.message}`,
          latency: Date.now() - startConnTest,
        });
      }

      // Teste 3: Verificar lista M3U padrão
      const startM3UTest = Date.now();
      try {
        const { data: m3uList, error: m3uError } = await supabase
          .from('m3u_lists')
          .select('id, name, status')
          .eq('is_default', true)
          .eq('status', 'active')
          .maybeSingle();

        if (m3uError) {
          results.push({
            test: 'Lista M3U Padrão',
            status: 'error',
            message: `Erro ao buscar lista: ${m3uError.message}`,
            latency: Date.now() - startM3UTest,
          });
        } else if (m3uList) {
          results.push({
            test: 'Lista M3U Padrão',
            status: 'success',
            message: `Lista "${m3uList.name}" encontrada e ativa`,
            latency: Date.now() - startM3UTest,
            details: m3uList,
          });
        } else {
          results.push({
            test: 'Lista M3U Padrão',
            status: 'warning',
            message: 'Nenhuma lista M3U padrão ativa encontrada',
            latency: Date.now() - startM3UTest,
          });
        }
      } catch (error: any) {
        results.push({
          test: 'Lista M3U Padrão',
          status: 'error',
          message: `Erro ao verificar lista: ${error.message}`,
          latency: Date.now() - startM3UTest,
        });
      }

      setTestResults(results);

      // Determinar status geral
      const hasErrors = results.some(r => r.status === 'error');
      const hasWarnings = results.some(r => r.status === 'warning');
      
      if (hasErrors) {
        setOverallStatus('error');
        toast({
          title: "Testes concluídos com erros",
          description: "Alguns testes falharam. Verifique os detalhes abaixo.",
          variant: "destructive",
        });
      } else if (hasWarnings) {
        setOverallStatus('warning');
        toast({
          title: "Testes concluídos com avisos",
          description: "Alguns testes geraram avisos. Verifique os detalhes abaixo.",
        });
      } else {
        setOverallStatus('success');
        toast({
          title: "Todos os testes passaram",
          description: "SmartOne está funcionando corretamente!",
        });
      }

    } catch (error: any) {
      toast({
        title: "Erro ao executar testes",
        description: error.message,
        variant: "destructive",
      });
      setOverallStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500">Aviso</Badge>;
    }
  };

  const runPlaylistCreationTest = async () => {
    // Validar formulário
    if (!playlistForm.nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome da playlist/cliente",
        variant: "destructive",
      });
      return;
    }

    if (!playlistForm.mac.trim()) {
      toast({
        title: "MAC obrigatório",
        description: "Informe o endereço MAC",
        variant: "destructive",
      });
      return;
    }

    // Validar MAC
    const macValidation = validateMacAddress(playlistForm.mac);
    if (!macValidation.valid) {
      toast({
        title: "MAC inválido",
        description: macValidation.error || "Formato de MAC inválido",
        variant: "destructive",
      });
      return;
    }

    if (!playlistForm.m3uUrl.trim()) {
      toast({
        title: "URL M3U obrigatória",
        description: "Informe a URL da playlist M3U",
        variant: "destructive",
      });
      return;
    }

    // Validar URL
    try {
      new URL(playlistForm.m3uUrl);
    } catch {
      toast({
        title: "URL inválida",
        description: "Informe uma URL válida para a playlist M3U",
        variant: "destructive",
      });
      return;
    }

    setTestingPlaylist(true);
    setPlaylistTestResult(null);

    try {
      const startTime = Date.now();

      // Normalizar MAC
      const normalizedMac = normalizeMacAddress(playlistForm.mac);

      const { data, error } = await supabase.functions.invoke('smartone-test', {
        body: {
          action: 'create',
          playlist: {
            nome: playlistForm.nome,
            mac: normalizedMac,
            m3u_url: playlistForm.m3uUrl,
          }
        }
      });

      const latency = Date.now() - startTime;

      if (error) {
        setPlaylistTestResult({
          success: false,
          error: error.message,
          latency_ms: latency,
        });
        
        toast({
          title: "Erro no teste",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setPlaylistTestResult({
          ...data,
          latency_ms: latency,
        });

        if (data.success) {
          toast({
            title: "Teste bem-sucedido!",
            description: `Playlist criada com sucesso no SmartOne em ${latency}ms`,
          });
        } else {
          toast({
            title: "Falha no teste",
            description: data.error || "Erro desconhecido",
            variant: "destructive",
          });
        }
      }

    } catch (error: any) {
      setPlaylistTestResult({
        success: false,
        error: error.message,
      });

      toast({
        title: "Erro ao executar teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingPlaylist(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Teste de Conectividade SmartOne</h1>
              <p className="text-muted-foreground">
                Valide credenciais e disponibilidade da API SmartOne
              </p>
            </div>
          </div>
        </div>

        {/* Status geral */}
        {overallStatus !== 'idle' && (
          <Alert variant={overallStatus === 'error' ? 'destructive' : 'default'}>
            {overallStatus === 'success' ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : overallStatus === 'error' ? (
              <WifiOff className="h-4 w-4" />
            ) : (
              <Activity className="h-4 w-4 text-yellow-500" />
            )}
            <AlertTitle>
              {overallStatus === 'success' && 'Conectividade OK'}
              {overallStatus === 'error' && 'Problemas Detectados'}
              {overallStatus === 'warning' && 'Avisos Detectados'}
            </AlertTitle>
            <AlertDescription>
              {overallStatus === 'success' && 'Todos os testes passaram. SmartOne está operacional.'}
              {overallStatus === 'error' && 'Alguns testes falharam. Verifique as configurações.'}
              {overallStatus === 'warning' && 'Alguns avisos foram detectados. Revise os detalhes.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Configurações de teste */}
        <Card>
          <CardHeader>
            <CardTitle>Teste de Conectividade</CardTitle>
            <CardDescription>
              Valida autenticação, permissões e conectividade com SmartOne API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runConnectivityTest}
              disabled={testing}
              className="w-full md:w-auto"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Executar Healthcheck
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Teste de Criação de Playlist */}
        <Card>
          <CardHeader>
            <CardTitle>Simulador de Criação de Playlist</CardTitle>
            <CardDescription>
              Teste a criação de uma playlist no SmartOne com dados customizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Cliente/Playlist</Label>
                <Input
                  id="nome"
                  placeholder="Ex: João Silva"
                  value={playlistForm.nome}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, nome: e.target.value })}
                  disabled={testingPlaylist}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mac">MAC Address</Label>
                <Input
                  id="mac"
                  placeholder="Ex: 00:1A:2B:3C:4D:5E"
                  value={playlistForm.mac}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, mac: e.target.value })}
                  disabled={testingPlaylist}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX ou XXXXXXXXXXXX
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="m3uUrl">URL da Playlist M3U</Label>
              <Input
                id="m3uUrl"
                placeholder="Ex: https://exemplo.com/playlist.m3u"
                value={playlistForm.m3uUrl}
                onChange={(e) => setPlaylistForm({ ...playlistForm, m3uUrl: e.target.value })}
                disabled={testingPlaylist}
              />
            </div>

            <Button
              onClick={runPlaylistCreationTest}
              disabled={testingPlaylist}
              className="w-full md:w-auto"
            >
              {testingPlaylist ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testando Criação...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Testar Criação de Playlist
                </>
              )}
            </Button>

            {/* Resultado do teste de playlist */}
            {playlistTestResult && (
              <div className="mt-6">
                <Alert variant={playlistTestResult.success ? 'default' : 'destructive'}>
                  {playlistTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {playlistTestResult.success ? 'Playlist Criada com Sucesso' : 'Falha na Criação'}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {playlistTestResult.success 
                        ? `A playlist foi criada no SmartOne com sucesso!`
                        : playlistTestResult.error || 'Erro desconhecido ao criar playlist'
                      }
                    </p>
                    
                    {playlistTestResult.latency_ms && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3" />
                        <span>Tempo de resposta: {playlistTestResult.latency_ms}ms</span>
                      </div>
                    )}

                    {playlistTestResult.playlistId && (
                      <div className="text-sm">
                        <strong>ID da Playlist:</strong> {playlistTestResult.playlistId}
                      </div>
                    )}

                    {playlistTestResult.data && (
                      <details className="text-xs mt-2">
                        <summary className="cursor-pointer hover:text-foreground">
                          Ver resposta completa do SmartOne
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                          {JSON.stringify(playlistTestResult.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultados dos testes */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados dos Testes</CardTitle>
              <CardDescription>
                Detalhes de cada teste executado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <div className="mt-1">{getStatusIcon(result.status)}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{result.test}</h3>
                        <div className="flex items-center gap-2">
                          {result.latency && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {result.latency}ms
                            </Badge>
                          )}
                          {getStatusBadge(result.status)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {result.message}
                      </p>
                      {result.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver detalhes técnicos
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminSmartOneTest;
