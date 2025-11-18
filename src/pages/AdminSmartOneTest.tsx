import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  AlertTriangle
} from "lucide-react";

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
  const [testMAC, setTestMAC] = useState('00:1A:2B:3C:4D:5E');
  const [testUsername, setTestUsername] = useState('test_user');
  const [testPassword, setTestPassword] = useState('test_pass');
  const [overallStatus, setOverallStatus] = useState<'idle' | 'success' | 'error' | 'warning'>('idle');

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
      // Teste 1: Validar formato de MAC
      const startMacTest = Date.now();
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (macRegex.test(testMAC)) {
        results.push({
          test: 'Validação MAC',
          status: 'success',
          message: 'Formato de MAC address válido',
          latency: Date.now() - startMacTest,
        });
      } else {
        results.push({
          test: 'Validação MAC',
          status: 'error',
          message: 'Formato de MAC address inválido',
          latency: Date.now() - startMacTest,
        });
      }

      // Teste 2: Validar credenciais M3U
      const startCredsTest = Date.now();
      if (testUsername.length >= 3 && testPassword.length >= 4) {
        results.push({
          test: 'Credenciais M3U',
          status: 'success',
          message: 'Credenciais M3U válidas',
          latency: Date.now() - startCredsTest,
        });
      } else {
        results.push({
          test: 'Credenciais M3U',
          status: 'warning',
          message: 'Credenciais muito curtas (mín: usuário 3 chars, senha 4 chars)',
          latency: Date.now() - startCredsTest,
        });
      }

      // Teste 3: Testar conectividade com a API SmartOne
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
          const { data, error } = await supabase.functions.invoke('smartone-sync', {
            body: {
              mac: testMAC,
              usuario: testUsername,
              senha: testPassword,
              clienteNome: 'Teste de Conectividade',
            },
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
              message: 'API SmartOne respondeu com sucesso',
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

      // Teste 4: Verificar lista M3U padrão
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
            <CardTitle>Configurações de Teste</CardTitle>
            <CardDescription>
              Configure os dados para testar a API SmartOne
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testMAC">MAC Address de Teste</Label>
                <Input
                  id="testMAC"
                  value={testMAC}
                  onChange={(e) => setTestMAC(e.target.value)}
                  placeholder="00:1A:2B:3C:4D:5E"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testUsername">Usuário de Teste</Label>
                <Input
                  id="testUsername"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  placeholder="test_user"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testPassword">Senha de Teste</Label>
                <Input
                  id="testPassword"
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="test_pass"
                />
              </div>
            </div>

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
                  Executar Testes
                </>
              )}
            </Button>
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
