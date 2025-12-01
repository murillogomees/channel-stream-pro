import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Shield, User, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export default function AdminPermissionTest() {
  const { user, isAuthenticated, isAdmin, isMaster, isClient, loading } = useAuth();
  const [dbTests, setDbTests] = useState<TestResult[]>([]);
  const [rpcTests, setRpcTests] = useState<TestResult[]>([]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      runDatabaseTests();
      runRPCTests();
    }
  }, [loading, isAuthenticated]);

  const runDatabaseTests = async () => {
    const tests: TestResult[] = [];

    // Test profiles table
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      tests.push({
        name: 'SELECT profiles',
        passed: !error,
        message: error?.message
      });
    } catch (e: any) {
      tests.push({ name: 'SELECT profiles', passed: false, message: e.message });
    }

    // Test clientes table
    try {
      const { error } = await supabase.from('clientes').select('id').limit(1);
      tests.push({
        name: 'SELECT clientes',
        passed: !error,
        message: error?.message
      });
    } catch (e: any) {
      tests.push({ name: 'SELECT clientes', passed: false, message: e.message });
    }

    // Test user_roles table
    try {
      const { error } = await supabase.from('user_roles').select('*').limit(1);
      tests.push({
        name: 'SELECT user_roles',
        passed: !error,
        message: error?.message
      });
    } catch (e: any) {
      tests.push({ name: 'SELECT user_roles', passed: false, message: e.message });
    }

    setDbTests(tests);
  };

  const runRPCTests = async () => {
    const tests: TestResult[] = [];

    if (user?.id) {
      // Test is_admin RPC
      try {
        const { data, error } = await supabase.rpc('is_admin', { uid: user.id });
        tests.push({
          name: 'is_admin RPC',
          passed: !error,
          message: error?.message || `Result: ${data}`
        });
      } catch (e: any) {
        tests.push({ name: 'is_admin RPC', passed: false, message: e.message });
      }

      // Test has_role RPC
      try {
        const { data, error } = await supabase.rpc('has_role', { 
          _user_id: user.id, 
          _role: 'admin' 
        });
        tests.push({
          name: 'has_role RPC (admin)',
          passed: !error,
          message: error?.message || `Result: ${data}`
        });
      } catch (e: any) {
        tests.push({ name: 'has_role RPC (admin)', passed: false, message: e.message });
      }
    }

    setRpcTests(tests);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Teste de Permissões</h1>
          <p className="text-muted-foreground">Diagnóstico completo do sistema de autenticação</p>
        </div>
      </div>

      <Separator />

      {/* Authentication Context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Contexto de Autenticação
          </CardTitle>
          <CardDescription>Estado atual do usuário autenticado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Autenticado:</span>
              <Badge variant={isAuthenticated ? "default" : "destructive"} className="ml-2">
                {isAuthenticated ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Carregando:</span>
              <Badge variant={loading ? "secondary" : "outline"} className="ml-2">
                {loading ? 'Sim' : 'Não'}
              </Badge>
            </div>
          </div>

          {user && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm"><strong>ID:</strong> {user.id}</p>
                <p className="text-sm"><strong>Nome:</strong> {user.nome}</p>
                <p className="text-sm"><strong>Email:</strong> {user.email}</p>
                <p className="text-sm"><strong>Roles:</strong> {user.roles.join(', ')}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Permission Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Flags de Permissão
          </CardTitle>
          <CardDescription>Verificação de roles e permissões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {isAdmin ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <span className="text-sm">isAdmin</span>
            </div>
            <div className="flex items-center gap-2">
              {isMaster ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <span className="text-sm">isMaster</span>
            </div>
            <div className="flex items-center gap-2">
              {isClient ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <span className="text-sm">isClient</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Testes de Banco de Dados
          </CardTitle>
          <CardDescription>Testes de acesso SELECT em tabelas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dbTests.map((test, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                {test.passed ? 
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> : 
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                }
                <div className="flex-1">
                  <p className="font-medium">{test.name}</p>
                  {test.message && (
                    <p className="text-sm text-muted-foreground">{test.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RPC Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Testes de RPC Functions
          </CardTitle>
          <CardDescription>Testes de funções RPC do Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rpcTests.map((test, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                {test.passed ? 
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" /> : 
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                }
                <div className="flex-1">
                  <p className="font-medium">{test.name}</p>
                  {test.message && (
                    <p className="text-sm text-muted-foreground">{test.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
