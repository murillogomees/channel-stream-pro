import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle, Download, AlertTriangle, History, CheckCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface DiagnosticResult {
  label: string;
  value: any;
  status: 'success' | 'error' | 'warning';
  details?: string;
}

interface HistoricalDiagnostic {
  id: string;
  executed_at: string;
  has_discrepancy: boolean;
  full_diagnostic_data: any;
  discrepancy_details?: any;
  roles_via_table?: string[];
  roles_via_rpc?: string[];
  is_admin_rpc?: boolean;
  auth_context_is_admin?: boolean;
  auth_context_is_super_admin?: boolean;
  auth_context_is_client?: boolean;
  jwt_role?: string;
}

interface DiscrepancyAlert {
  id: string;
  discrepancy_type: string;
  discrepancy_description: string;
  severity: string;
  resolved: boolean;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

const AdminDiagnostic = () => {
  const navigate = useNavigate();
  const { user, session, isAdmin, isSuperAdmin, isClient, loading: authLoading } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [historicalDiagnostics, setHistoricalDiagnostics] = useState<HistoricalDiagnostic[]>([]);
  const [discrepancyAlerts, setDiscrepancyAlerts] = useState<DiscrepancyAlert[]>([]);
  const [resolvingAlert, setResolvingAlert] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

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

      // Salvar diagnóstico no banco
      await saveDiagnosticToDatabase(results);
      
      // Carregar histórico e alertas
      await loadHistoricalDiagnostics();
      await loadDiscrepancyAlerts();
      
      toast.success("Diagnóstico completo!");
    } catch (error: any) {
      console.error('Erro no diagnóstico:', error);
      toast.error(`Erro ao executar diagnóstico: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveDiagnosticToDatabase = async (results: DiagnosticResult[]) => {
    if (!session?.user?.id) return;

    try {
      // Extrair valores específicos dos resultados
      const rolesViaTable = results.find(r => r.label === "Roles via SELECT (user_roles table)")?.value?.split(', ').filter(Boolean) || [];
      const rolesViaRpc = [
        results.find(r => r.label === "RPC has_role('admin')")?.value ? 'admin' : null,
        results.find(r => r.label === "RPC has_role('client')")?.value ? 'client' : null,
      ].filter(Boolean);
      
      const isAdminRpc = results.find(r => r.label === "RPC is_admin(uid)")?.value || false;
      const authContextIsAdmin = results.find(r => r.label === "AuthContext.isAdmin")?.value || false;
      const authContextIsSuperAdmin = results.find(r => r.label === "AuthContext.isSuperAdmin")?.value || false;
      const authContextIsClient = results.find(r => r.label === "AuthContext.isClient")?.value || false;
      const jwtRole = results.find(r => r.label === "JWT role claim")?.value || 'N/A';

      // Inserir diagnóstico
      const { data: diagnostic, error: diagnosticError } = await supabase
        .from('permission_diagnostics')
        .insert([{
          user_id: session.user.id,
          user_email: session.user.email || 'N/A',
          session_active: !!session,
          roles_via_table: rolesViaTable,
          roles_via_rpc: rolesViaRpc,
          is_admin_rpc: isAdminRpc,
          auth_context_is_admin: authContextIsAdmin,
          auth_context_is_super_admin: authContextIsSuperAdmin,
          auth_context_is_client: authContextIsClient,
          jwt_role: jwtRole,
          full_diagnostic_data: results as any
        }])
        .select()
        .single();

      if (diagnosticError) {
        console.error('Erro ao salvar diagnóstico:', diagnosticError);
        return;
      }

      // Detectar discrepâncias usando função do banco
      await supabase.rpc('detect_permission_discrepancies', {
        _diagnostic_id: diagnostic.id,
        _user_id: session.user.id,
        _user_email: session.user.email || 'N/A',
        _roles_table: rolesViaTable,
        _roles_rpc: rolesViaRpc,
        _is_admin_rpc: isAdminRpc,
        _auth_context_is_admin: authContextIsAdmin
      });

    } catch (error) {
      console.error('Erro ao processar diagnóstico:', error);
    }
  };

  const loadHistoricalDiagnostics = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('permission_diagnostics')
        .select('*')
        .eq('user_id', session.user.id)
        .order('executed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistoricalDiagnostics(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const loadDiscrepancyAlerts = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('permission_discrepancy_alerts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscrepancyAlerts(data || []);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    }
  };

  const exportDiagnosticToJSON = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      user: {
        id: session?.user?.id,
        email: session?.user?.email,
        nome: user?.nome
      },
      diagnostics: diagnostics,
      alerts: discrepancyAlerts,
      history: historicalDiagnostics
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagnostic-${session?.user?.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Diagnóstico exportado com sucesso!");
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('permission_discrepancy_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: resolutionNotes
        })
        .eq('id', alertId);

      if (error) throw error;

      toast.success("Alerta resolvido com sucesso!");
      setResolvingAlert(null);
      setResolutionNotes("");
      loadDiscrepancyAlerts();
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      toast.error("Falha ao resolver alerta");
    }
  };

  useEffect(() => {
    if (!authLoading && session) {
      runDiagnostics();
      loadHistoricalDiagnostics();
      loadDiscrepancyAlerts();
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

        {discrepancyAlerts.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> {discrepancyAlerts.length} discrepância(s) detectada(s) nas permissões. 
              Verifique a aba "Alertas" para mais detalhes.
            </AlertDescription>
          </Alert>
        )}

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

        <Tabs defaultValue="diagnostico" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diagnostico">Diagnóstico Atual</TabsTrigger>
            <TabsTrigger value="alertas">
              Alertas {discrepancyAlerts.length > 0 && `(${discrepancyAlerts.length})`}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostico">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Resultados do Diagnóstico</CardTitle>
                    <CardDescription>Verificação de roles e permissões em diferentes camadas</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={exportDiagnosticToJSON}
                      disabled={diagnostics.length === 0}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Exportar JSON
                    </Button>
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
          </TabsContent>

          <TabsContent value="alertas">
            <Card>
              <CardHeader>
                <CardTitle>Alertas de Discrepâncias</CardTitle>
                <CardDescription>
                  Inconsistências detectadas automaticamente entre diferentes métodos de verificação de permissões
                </CardDescription>
              </CardHeader>
              <CardContent>
                {discrepancyAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma discrepância detectada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {discrepancyAlerts.map((alert) => (
                      <Card key={alert.id} className={alert.resolved ? "border-muted" : "border-destructive"}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className={`flex items-center gap-2 ${alert.resolved ? 'text-muted-foreground' : 'text-destructive'}`}>
                                {alert.resolved ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                                {alert.discrepancy_type.replace('_', ' ').toUpperCase()}
                              </CardTitle>
                              <CardDescription>{alert.discrepancy_description}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                                {alert.severity}
                              </Badge>
                              {alert.resolved && (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500">
                                  Resolvido
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Detectado em: {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm")}
                            </p>
                            {alert.resolved && (
                              <>
                                <p className="text-sm text-muted-foreground">
                                  Resolvido em: {alert.resolved_at ? format(new Date(alert.resolved_at), "dd/MM/yyyy 'às' HH:mm") : 'N/A'}
                                </p>
                                {alert.resolution_notes && (
                                  <div className="mt-2 p-2 bg-muted rounded">
                                    <p className="text-sm font-medium mb-1">Notas de resolução:</p>
                                    <p className="text-sm text-muted-foreground">{alert.resolution_notes}</p>
                                  </div>
                                )}
                              </>
                            )}
                            {!alert.resolved && (
                              <Button
                                onClick={() => setResolvingAlert(alert.id)}
                                variant="outline"
                                size="sm"
                                className="mt-2"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Marcar como resolvido
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Diagnósticos</CardTitle>
                <CardDescription>
                  <History className="inline h-4 w-4 mr-1" />
                  Últimos 10 diagnósticos executados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historicalDiagnostics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum histórico disponível</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historicalDiagnostics.map((hist) => (
                      <div key={hist.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {format(new Date(hist.executed_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                            </p>
                            {hist.has_discrepancy && (
                              <Badge variant="destructive">Com Discrepâncias</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const blob = new Blob([JSON.stringify(hist.full_diagnostic_data, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `diagnostic-${hist.id}.json`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Roles (tabela):</span>
                            <span className="ml-2 font-mono">{hist.roles_via_table?.join(', ') || 'nenhum'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Roles (RPC):</span>
                            <span className="ml-2 font-mono">{hist.roles_via_rpc?.join(', ') || 'nenhum'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">is_admin (RPC):</span>
                            <span className="ml-2 font-mono">{hist.is_admin_rpc ? 'TRUE' : 'FALSE'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">is_admin (Context):</span>
                            <span className="ml-2 font-mono">{hist.auth_context_is_admin ? 'TRUE' : 'FALSE'}</span>
                          </div>
                        </div>
                        {hist.discrepancy_details && (
                          <div className="mt-3 p-2 bg-destructive/10 rounded border border-destructive/20">
                            <p className="text-sm font-medium text-destructive mb-1">Discrepâncias detectadas:</p>
                            <pre className="text-xs overflow-auto">{JSON.stringify(hist.discrepancy_details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
