import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface DiagnosticResult {
  label: string;
  value: any;
  status: 'success' | 'error' | 'warning';
  details?: string;
}

const AdminDiagnostic = () => {
  const navigate = useNavigate();
  const { user, session, isAdmin, isSuperAdmin, isClient, loading: authLoading } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    if (!session?.user?.id) {
      toast.error("Nenhuma sessão ativa encontrada");
      return;
    }

    setLoading(true);
    const results: DiagnosticResult[] = [];

    try {
      // 1. Sessão atual
      results.push({
        label: "Sessão Supabase Ativa",
        value: !!session,
        status: session ? 'success' : 'error',
        details: session ? `User ID: ${session.user.id}` : 'Nenhuma sessão ativa'
      });

      // 2. User ID
      results.push({
        label: "User ID",
        value: session.user.id,
        status: 'success',
        details: `Email: ${session.user.email}`
      });

      // 3. Roles via SELECT direto na tabela
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      results.push({
        label: "Roles via SELECT (user_roles table)",
        value: rolesError ? 'ERROR' : (rolesData || []).map(r => r.role).join(', '),
        status: rolesError ? 'error' : (rolesData && rolesData.length > 0 ? 'success' : 'warning'),
        details: rolesError ? rolesError.message : `${rolesData?.length || 0} role(s) encontrada(s)`
      });

      // 4. Roles via RPC has_role (admin)
      const { data: hasAdminRole, error: hasAdminError } = await supabase
        .rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

      results.push({
        label: "RPC has_role('admin')",
        value: hasAdminError ? 'ERROR' : hasAdminRole,
        status: hasAdminError ? 'error' : (hasAdminRole ? 'success' : 'warning'),
        details: hasAdminError ? hasAdminError.message : (hasAdminRole ? 'Usuário é admin' : 'Usuário não é admin')
      });

      // 5. Roles via RPC has_role (client)
      const { data: hasClientRole, error: hasClientError } = await supabase
        .rpc('has_role', {
          _user_id: session.user.id,
          _role: 'client'
        });

      results.push({
        label: "RPC has_role('client')",
        value: hasClientError ? 'ERROR' : hasClientRole,
        status: hasClientError ? 'error' : (hasClientRole ? 'success' : 'warning'),
        details: hasClientError ? hasClientError.message : (hasClientRole ? 'Usuário é client' : 'Usuário não é client')
      });

      // 6. is_admin RPC
      const { data: isAdminRpc, error: isAdminError } = await supabase
        .rpc('is_admin', { uid: session.user.id });

      results.push({
        label: "RPC is_admin(uid)",
        value: isAdminError ? 'ERROR' : isAdminRpc,
        status: isAdminError ? 'error' : (isAdminRpc ? 'success' : 'warning'),
        details: isAdminError ? isAdminError.message : (isAdminRpc ? 'is_admin retornou TRUE' : 'is_admin retornou FALSE')
      });

      // 7. AuthContext values
      results.push({
        label: "AuthContext.isAdmin",
        value: isAdmin,
        status: isAdmin ? 'success' : 'warning',
        details: `Valor computado pelo AuthContext`
      });

      results.push({
        label: "AuthContext.isSuperAdmin",
        value: isSuperAdmin,
        status: isSuperAdmin ? 'success' : 'warning',
        details: `Valor computado pelo AuthContext`
      });

      results.push({
        label: "AuthContext.isClient",
        value: isClient,
        status: isClient ? 'success' : 'warning',
        details: `Valor computado pelo AuthContext`
      });

      // 8. Roles no UnifiedUser
      results.push({
        label: "AuthContext.user.roles",
        value: user?.roles ? user.roles.join(', ') : 'NENHUM',
        status: (user?.roles && user.roles.length > 0) ? 'success' : 'error',
        details: `${user?.roles?.length || 0} role(s) no objeto UnifiedUser`
      });

      // 9. JWT claims (tentar extrair do access_token)
      if (session.access_token) {
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          results.push({
            label: "JWT role claim",
            value: payload.role || 'NÃO DEFINIDO',
            status: payload.role === 'authenticated' ? 'success' : 'warning',
            details: `role no JWT: ${payload.role}. user_role: ${payload.user_role || 'não definido'}`
          });
        } catch (e) {
          results.push({
            label: "JWT role claim",
            value: 'ERRO AO DECODIFICAR',
            status: 'error',
            details: 'Não foi possível decodificar o JWT'
          });
        }
      }

      setDiagnostics(results);
      toast.success("Diagnóstico completo!");
    } catch (error: any) {
      console.error('Erro no diagnóstico:', error);
      toast.error(`Erro ao executar diagnóstico: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && session) {
      runDiagnostics();
    }
  }, [authLoading, session]);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      warning: 'secondary'
    } as const;
    return variants[status];
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando diagnóstico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Diagnóstico de Permissões</h1>
            <p className="text-muted-foreground mt-2">
              Ferramentas de depuração para verificar autenticação e roles
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Informações da Sessão</CardTitle>
            <CardDescription>Dados básicos do usuário autenticado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nome</p>
                <p className="text-lg font-semibold">{user?.nome || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-lg font-semibold">{user?.email || session?.user?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="text-sm font-mono bg-muted p-2 rounded">{session?.user?.id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p className="text-lg font-semibold">{user?.telefone || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resultados do Diagnóstico</CardTitle>
                <CardDescription>Verificação de roles e permissões em diferentes camadas</CardDescription>
              </div>
              <Button 
                onClick={runDiagnostics} 
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {diagnostics.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Executando diagnóstico...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {diagnostics.map((result, index) => (
                  <div key={index}>
                    <div className="flex items-start gap-4 py-3">
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(result.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{result.label}</p>
                          <Badge variant={getStatusBadge(result.status)}>
                            {result.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block mb-1">
                          {typeof result.value === 'boolean' 
                            ? (result.value ? 'TRUE' : 'FALSE')
                            : String(result.value)}
                        </p>
                        {result.details && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.details}
                          </p>
                        )}
                      </div>
                    </div>
                    {index < diagnostics.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Guia de Interpretação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">✓ SUCCESS:</strong> Valor correto e esperado para funcionamento normal.
            </p>
            <p>
              <strong className="text-foreground">⚠ WARNING:</strong> Valor possivelmente incorreto ou inesperado. Pode causar problemas de acesso.
            </p>
            <p>
              <strong className="text-foreground">✗ ERROR:</strong> Erro ao executar verificação. Indica problema sério na configuração.
            </p>
            <Separator />
            <p className="text-xs">
              <strong>Nota:</strong> Se "SELECT user_roles" falhar mas "RPC has_role" funcionar, significa que há um problema de RLS na tabela user_roles.
              O fallback via RPC garante que o sistema continue funcionando.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDiagnostic;
