/**
 * PÁGINA DE VALIDAÇÃO DE PERMISSÕES
 * 
 * Testa visualmente se as roles e permissões estão funcionando corretamente.
 * Apenas admins podem acessar esta página.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  User, 
  Eye,
  Edit,
  Trash2,
  Database,
  Key,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestResult {
  name: string;
  description: string;
  passed: boolean;
  message: string;
}

export default function AdminPermissionTest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, isSuperAdmin, isClient, loading } = useAuth();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        title: 'Acesso negado',
        description: 'Apenas administradores podem acessar esta página.',
        variant: 'destructive',
      });
      navigate('/admin/dashboard');
    }
  }, [loading, isAdmin, navigate, toast]);

  const runTests = async () => {
    setTesting(true);
    const testResults: TestResult[] = [];

    // 1. Verificar contexto de autenticação
    testResults.push({
      name: 'Contexto de Autenticação',
      description: 'Verificar se o usuário está autenticado e contexto carregado',
      passed: !!user && !!user.id,
      message: user ? `Usuário: ${user.email}` : 'Usuário não identificado'
    });

    // 2. Verificar roles do usuário
    const rolesText = user?.roles.join(', ') || 'Nenhuma';
    testResults.push({
      name: 'Roles do Usuário',
      description: 'Verificar roles atribuídas ao usuário',
      passed: (user?.roles.length || 0) > 0,
      message: `Roles: ${rolesText}`
    });

    // 3. Verificar flags de permissão
    testResults.push({
      name: 'Flags de Permissão',
      description: 'Verificar se flags isAdmin, isSuperAdmin, isClient estão corretas',
      passed: isAdmin,
      message: `isAdmin: ${isAdmin}, isSuperAdmin: ${isSuperAdmin}, isClient: ${isClient}`
    });

    // 4. Testar SELECT em profiles (próprio perfil)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      testResults.push({
        name: 'SELECT - Próprio Perfil',
        description: 'Leitura do próprio registro em profiles',
        passed: !error && !!data,
        message: error ? `Erro: ${error.message}` : 'Acesso concedido'
      });
    } catch (err: any) {
      testResults.push({
        name: 'SELECT - Próprio Perfil',
        description: 'Leitura do próprio registro em profiles',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    // 5. Testar SELECT em profiles (todos os usuários - apenas admin)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .limit(5);

      testResults.push({
        name: 'SELECT - Todos os Perfis (Admin)',
        description: 'Leitura de todos os perfis (apenas admin)',
        passed: !error && !!data && data.length > 0,
        message: error ? `Erro: ${error.message}` : `Acesso concedido (${data?.length || 0} registros)`
      });
    } catch (err: any) {
      testResults.push({
        name: 'SELECT - Todos os Perfis (Admin)',
        description: 'Leitura de todos os perfis (apenas admin)',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    // 6. Testar SELECT em clientes (dados de clientes - apenas admin)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, situacao')
        .limit(5);

      testResults.push({
        name: 'SELECT - Clientes (Admin)',
        description: 'Leitura de dados de clientes (apenas admin)',
        passed: !error,
        message: error ? `Erro: ${error.message}` : `Acesso concedido (${data?.length || 0} registros)`
      });
    } catch (err: any) {
      testResults.push({
        name: 'SELECT - Clientes (Admin)',
        description: 'Leitura de dados de clientes (apenas admin)',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    // 7. Testar SELECT em user_roles (próprias roles)
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user?.id);

      testResults.push({
        name: 'SELECT - Próprias Roles',
        description: 'Leitura das próprias roles',
        passed: !error && !!data,
        message: error ? `Erro: ${error.message}` : `Acesso concedido (${data?.length || 0} roles)`
      });
    } catch (err: any) {
      testResults.push({
        name: 'SELECT - Próprias Roles',
        description: 'Leitura das próprias roles',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    // 8. Testar SELECT em user_roles (todas - apenas admin)
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .limit(10);

      testResults.push({
        name: 'SELECT - Todas as Roles (Admin)',
        description: 'Leitura de todas as roles (apenas admin)',
        passed: !error && !!data,
        message: error ? `Erro: ${error.message}` : `Acesso concedido (${data?.length || 0} registros)`
      });
    } catch (err: any) {
      testResults.push({
        name: 'SELECT - Todas as Roles (Admin)',
        description: 'Leitura de todas as roles (apenas admin)',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    // 9. Testar função is_admin()
    try {
      const { data, error } = await (supabase as any)
        .rpc('is_admin', { _user_id: user?.id });

      testResults.push({
        name: 'RPC - is_admin()',
        description: 'Testar função is_admin() no banco',
        passed: !error && data === true,
        message: error ? `Erro: ${error.message}` : `Retorno: ${data}`
      });
    } catch (err: any) {
      testResults.push({
        name: 'RPC - is_admin()',
        description: 'Testar função is_admin() no banco',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    // 10. Testar função has_role()
    try {
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user?.id, _role: 'admin' });

      testResults.push({
        name: 'RPC - has_role(admin)',
        description: 'Testar função has_role() no banco',
        passed: !error && data === true,
        message: error ? `Erro: ${error.message}` : `Retorno: ${data}`
      });
    } catch (err: any) {
      testResults.push({
        name: 'RPC - has_role(admin)',
        description: 'Testar função has_role() no banco',
        passed: false,
        message: `Exceção: ${err.message}`
      });
    }

    setResults(testResults);
    setTesting(false);

    // Mostrar resumo
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    
    toast({
      title: 'Testes Concluídos',
      description: `${passed} de ${total} testes passaram`,
      variant: passed === total ? 'default' : 'destructive',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const allPassed = passedTests === totalTests && totalTests > 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Validação de Permissões</h1>
          <p className="text-muted-foreground">Teste visual das roles e permissões do sistema</p>
        </div>
      </div>

      {/* Info do Usuário */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Usuário Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email:</span>
            <span className="font-mono text-sm">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ID:</span>
            <span className="font-mono text-xs">{user?.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Roles:</span>
            <div className="flex gap-2">
              {user?.roles.map(role => (
                <Badge key={role} variant={role === 'super_admin' ? 'destructive' : 'default'}>
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Permissões:</span>
            <div className="flex gap-2">
              {isAdmin && <Badge variant="outline">Admin</Badge>}
              {isSuperAdmin && <Badge variant="outline">Super Admin</Badge>}
              {isClient && <Badge variant="outline">Cliente</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controles */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Executar Testes
          </CardTitle>
          <CardDescription>
            Execute uma série de testes para validar as permissões do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runTests} 
            disabled={testing}
            className="w-full"
            size="lg"
          >
            {testing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Executando testes...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Executar Testes de Permissão
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Resultados
              </CardTitle>
              <Badge variant={allPassed ? 'default' : 'destructive'}>
                {passedTests}/{totalTests} testes passaram
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {allPassed && (
              <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Todos os testes passaram! O sistema de permissões está funcionando corretamente.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.passed 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800' 
                      : 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold ${
                          result.passed 
                            ? 'text-green-900 dark:text-green-100' 
                            : 'text-red-900 dark:text-red-100'
                        }`}>
                          {result.name}
                        </h3>
                      </div>
                      <p className={`text-sm mb-1 ${
                        result.passed 
                          ? 'text-green-700 dark:text-green-300' 
                          : 'text-red-700 dark:text-red-300'
                      }`}>
                        {result.description}
                      </p>
                      <p className={`text-sm font-mono ${
                        result.passed 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {result.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instruções */}
      {results.length === 0 && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription>
            Clique no botão acima para executar os testes de permissão. Os testes verificarão:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Contexto de autenticação</li>
              <li>Roles atribuídas ao usuário</li>
              <li>Acesso a dados próprios (profiles)</li>
              <li>Acesso a dados de todos os usuários (admin)</li>
              <li>Acesso a dados de clientes (admin)</li>
              <li>Funções RPC do banco (is_admin, has_role)</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
