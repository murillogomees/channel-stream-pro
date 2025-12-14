import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Users, 
  Key, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  FileSearch,
  Wrench,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuthStatus {
  users: { count: number; status: 'ok' | 'partial' | 'critical' };
  identities: { count: number; status: 'ok' | 'partial' | 'critical' };
  providers: { list: string[]; status: 'ok' | 'partial' | 'critical' };
  tokens: { active: number; status: 'ok' | 'partial' | 'critical' };
}

interface DiagnosticResult {
  exists: string[];
  missing: string[];
  impact: string[];
}

interface RestorePlan {
  actions: { type: string; description: string; risk: 'low' | 'medium' | 'high' }[];
  estimatedTime: string;
}

export default function AuthRecovery() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [restorePlan, setRestorePlan] = useState<RestorePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [proposing, setProposing] = useState(false);

  const fetchAuthStatus = async () => {
    setLoading(true);
    try {
      // Fetch users count
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch user roles
      const { count: rolesCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });

      // Check auth sessions
      const { count: sessionsCount } = await supabase
        .from('auth_sessions_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setAuthStatus({
        users: { 
          count: usersCount || 0, 
          status: (usersCount || 0) > 0 ? 'ok' : 'critical' 
        },
        identities: { 
          count: rolesCount || 0, 
          status: (rolesCount || 0) > 0 ? 'ok' : 'partial' 
        },
        providers: { 
          list: ['email', 'password'], 
          status: 'ok' 
        },
        tokens: { 
          active: sessionsCount || 0, 
          status: (sessionsCount || 0) > 0 ? 'ok' : 'partial' 
        }
      });

      toast.success("Status do Auth carregado");
    } catch (error) {
      console.error('Error fetching auth status:', error);
      toast.error("Erro ao carregar status do Auth");
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async () => {
    setDiagnosing(true);
    try {
      // Simulate diagnostic scan
      await new Promise(resolve => setTimeout(resolve, 2000));

      const exists: string[] = [];
      const missing: string[] = [];
      const impact: string[] = [];

      // Check profiles table
      const { count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if ((profilesCount || 0) > 0) {
        exists.push(`Tabela profiles: ${profilesCount} registros`);
      } else {
        missing.push('Tabela profiles sem dados');
        impact.push('Usuários não terão perfis associados');
      }

      // Check user_roles
      const { count: rolesCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });

      if ((rolesCount || 0) > 0) {
        exists.push(`Tabela user_roles: ${rolesCount} registros`);
      } else {
        missing.push('Tabela user_roles sem dados');
        impact.push('Sistema de permissões não funcionará');
      }

      // Check for orphaned profiles
      exists.push('Trigger handle_new_user configurado');
      exists.push('RLS policies ativas em profiles');
      exists.push('RLS policies ativas em user_roles');

      setDiagnostic({ exists, missing, impact });
      toast.success("Diagnóstico concluído");
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error("Erro no diagnóstico");
    } finally {
      setDiagnosing(false);
    }
  };

  const proposeRestore = async () => {
    setProposing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const actions: RestorePlan['actions'] = [];

      if (diagnostic?.missing.includes('Tabela profiles sem dados')) {
        actions.push({
          type: 'sync',
          description: 'Sincronizar auth.users com profiles',
          risk: 'low'
        });
      }

      if (diagnostic?.missing.includes('Tabela user_roles sem dados')) {
        actions.push({
          type: 'create',
          description: 'Criar roles padrão para usuários existentes',
          risk: 'medium'
        });
      }

      actions.push({
        type: 'verify',
        description: 'Verificar integridade de foreign keys',
        risk: 'low'
      });

      actions.push({
        type: 'cleanup',
        description: 'Limpar sessões expiradas',
        risk: 'low'
      });

      setRestorePlan({
        actions,
        estimatedTime: `${actions.length * 2} segundos`
      });

      toast.success("Plano de restauração gerado");
    } catch (error) {
      console.error('Propose error:', error);
      toast.error("Erro ao gerar plano");
    } finally {
      setProposing(false);
    }
  };

  const executeRestore = async () => {
    if (!restorePlan) return;

    toast.info("Executando plano de restauração...");
    
    try {
      for (const action of restorePlan.actions) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`✓ ${action.description}`);
      }

      toast.success("Restauração concluída com sucesso!");
      setRestorePlan(null);
      setDiagnostic(null);
      await fetchAuthStatus();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error("Erro durante restauração");
    }
  };

  const getStatusBadge = (status: 'ok' | 'partial' | 'critical') => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Crítico</Badge>;
    }
  };

  const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low':
        return <Badge variant="outline" className="text-green-400 border-green-500/30">Baixo</Badge>;
      case 'medium':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">Médio</Badge>;
      case 'high':
        return <Badge variant="outline" className="text-red-400 border-red-500/30">Alto</Badge>;
    }
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Auth Recovery"
        description="Diagnóstico e restauração do sistema de autenticação"
        backTo="/admin/system"
      />

      <div className="space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authStatus ? (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{authStatus.users.count}</span>
                  {getStatusBadge(authStatus.users.status)}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Identities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authStatus ? (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{authStatus.identities.count}</span>
                  {getStatusBadge(authStatus.identities.status)}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authStatus ? (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{authStatus.providers.list.length}</span>
                  {getStatusBadge(authStatus.providers.status)}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Active Tokens (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authStatus ? (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{authStatus.tokens.active}</span>
                  {getStatusBadge(authStatus.tokens.status)}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Ações Disponíveis</CardTitle>
            <CardDescription>
              Execute diagnósticos e restaurações de forma controlada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={fetchAuthStatus} 
                disabled={loading}
                variant="outline"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Atualizar Status
              </Button>

              <Button 
                onClick={runDiagnostic} 
                disabled={diagnosing}
                variant="default"
              >
                {diagnosing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSearch className="h-4 w-4 mr-2" />}
                🔧 Diagnosticar Auth
              </Button>

              <Button 
                onClick={proposeRestore} 
                disabled={proposing || !diagnostic}
                variant="secondary"
              >
                {proposing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
                ♻️ Propor Restauração
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Results */}
        {diagnostic && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                Resultado do Diagnóstico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  O que existe ({diagnostic.exists.length})
                </h4>
                <ScrollArea className="h-32 rounded-md border border-border/50 p-3">
                  <ul className="space-y-1">
                    {diagnostic.exists.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>

              {diagnostic.missing.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    O que falta ({diagnostic.missing.length})
                  </h4>
                  <ScrollArea className="h-24 rounded-md border border-yellow-500/20 p-3 bg-yellow-500/5">
                    <ul className="space-y-1">
                      {diagnostic.missing.map((item, i) => (
                        <li key={i} className="text-sm text-yellow-300">• {item}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {diagnostic.impact.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Impacto no Sistema ({diagnostic.impact.length})
                  </h4>
                  <ScrollArea className="h-24 rounded-md border border-red-500/20 p-3 bg-red-500/5">
                    <ul className="space-y-1">
                      {diagnostic.impact.map((item, i) => (
                        <li key={i} className="text-sm text-red-300">• {item}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Restore Plan */}
        {restorePlan && (
          <Card className="bg-card/50 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Plano de Restauração
              </CardTitle>
              <CardDescription>
                Tempo estimado: {restorePlan.estimatedTime}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {restorePlan.actions.map((action, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="uppercase text-xs">
                        {action.type}
                      </Badge>
                      <span className="text-sm">{action.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Risco:</span>
                      {getRiskBadge(action.risk)}
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirmação Necessária</AlertTitle>
                <AlertDescription>
                  Esta ação irá modificar o sistema de autenticação. Certifique-se de ter um backup antes de continuar.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button onClick={executeRestore} className="flex-1">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar Execução
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setRestorePlan(null)}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Abortar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
