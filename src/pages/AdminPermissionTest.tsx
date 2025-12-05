import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Shield, User, Database, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export default function AdminPermissionTest() {
  const { user, isAuthenticated, isAdmin, isMaster, isClient, loading: authLoading } = useAuth();
  const [dbTests, setDbTests] = useState<TestResult[]>([]);
  const [rpcTests, setRpcTests] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      runAllTests();
    }
  }, [authLoading, isAuthenticated]);

  const runAllTests = async () => {
    setLoading(true);
    await Promise.all([runDatabaseTests(), runRPCTests()]);
    setLoading(false);
  };

  const runDatabaseTests = async () => {
    const tests: TestResult[] = [];

    // Test profiles table
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      tests.push({
        name: 'SELECT profiles',
        passed: !error,
        message: error?.message || 'Acesso permitido'
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
        message: error?.message || 'Acesso permitido'
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
        message: error?.message || 'Acesso permitido'
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
          message: error?.message || `Resultado: ${data}`
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
          message: error?.message || `Resultado: ${data}`
        });
      } catch (e: any) {
        tests.push({ name: 'has_role RPC (admin)', passed: false, message: e.message });
      }
    }

    setRpcTests(tests);
  };

  const passedDbTests = dbTests.filter(t => t.passed).length;
  const passedRpcTests = rpcTests.filter(t => t.passed).length;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Executando diagnósticos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-stat-purple/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-stat-purple" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Diagnóstico de Permissões</h2>
            <p className="text-sm text-muted-foreground">Status completo do sistema de autenticação</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={runAllTests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-testar
        </Button>
      </div>

      {/* Authentication Context */}
      <Card variant="surface">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-stat-info" />
            Contexto de Autenticação
          </CardTitle>
          <CardDescription>Estado atual do usuário autenticado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <span className="text-xs text-muted-foreground block mb-1">Autenticado</span>
              <Badge variant={isAuthenticated ? "default" : "destructive"} className={isAuthenticated ? "bg-stat-success/20 text-stat-success border-stat-success/30" : ""}>
                {isAuthenticated ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <span className="text-xs text-muted-foreground block mb-1">isAdmin</span>
              <Badge className={isAdmin ? "bg-stat-primary/20 text-stat-primary border-stat-primary/30" : "bg-muted text-muted-foreground"}>
                {isAdmin ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <span className="text-xs text-muted-foreground block mb-1">isMaster</span>
              <Badge className={isMaster ? "bg-stat-purple/20 text-stat-purple border-stat-purple/30" : "bg-muted text-muted-foreground"}>
                {isMaster ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <span className="text-xs text-muted-foreground block mb-1">isClient</span>
              <Badge className={isClient ? "bg-stat-info/20 text-stat-info border-stat-info/30" : "bg-muted text-muted-foreground"}>
                {isClient ? 'Sim' : 'Não'}
              </Badge>
            </div>
          </div>

          {user && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Usuário</p>
                  <p className="font-medium text-foreground">{user.nome || user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Roles Atribuídas</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {user.roles.map((role, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Database Tests */}
      <Card variant={passedDbTests === dbTests.length ? "stat-success" : "stat-warning"}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              Testes de Banco de Dados
            </CardTitle>
            <Badge variant="outline" className="font-mono">
              {passedDbTests}/{dbTests.length}
            </Badge>
          </div>
          <CardDescription>Verificação de acesso SELECT em tabelas principais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dbTests.map((test, idx) => (
              <div 
                key={idx} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  test.passed 
                    ? 'bg-stat-success/5 border-stat-success/20' 
                    : 'bg-stat-danger/5 border-stat-danger/20'
                }`}
              >
                {test.passed ? 
                  <CheckCircle2 className="h-5 w-5 text-stat-success mt-0.5 flex-shrink-0" /> : 
                  <XCircle className="h-5 w-5 text-stat-danger mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{test.name}</p>
                  {test.message && (
                    <p className="text-xs text-muted-foreground truncate">{test.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RPC Tests */}
      <Card variant={passedRpcTests === rpcTests.length ? "stat-success" : "stat-warning"}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Testes de RPC Functions
            </CardTitle>
            <Badge variant="outline" className="font-mono">
              {passedRpcTests}/{rpcTests.length}
            </Badge>
          </div>
          <CardDescription>Verificação de funções RPC do Supabase</CardDescription>
        </CardHeader>
        <CardContent>
          {rpcTests.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/30">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum teste RPC disponível</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rpcTests.map((test, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    test.passed 
                      ? 'bg-stat-success/5 border-stat-success/20' 
                      : 'bg-stat-danger/5 border-stat-danger/20'
                  }`}
                >
                  {test.passed ? 
                    <CheckCircle2 className="h-5 w-5 text-stat-success mt-0.5 flex-shrink-0" /> : 
                    <XCircle className="h-5 w-5 text-stat-danger mt-0.5 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{test.name}</p>
                    {test.message && (
                      <p className="text-xs text-muted-foreground truncate">{test.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
