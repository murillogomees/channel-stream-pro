/**
 * RLS Audit Panel - Security Analysis of Row Level Security Policies
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  FileCode,
  Lock,
  Unlock,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RLSPolicy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

interface RLSIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  table: string;
  issue: string;
  recommendation: string;
  policy_name?: string;
}

export function RLSAuditPanel() {
  const [policies, setPolicies] = useState<RLSPolicy[]>([]);
  const [issues, setIssues] = useState<RLSIssue[]>([]);
  const [tablesWithoutRLS, setTablesWithoutRLS] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadRLSData();
  }, []);

  const loadRLSData = async () => {
    setLoading(true);
    try {
      // Get all RLS policies
      const { data: policiesData, error: policiesError } = await supabase.rpc('get_all_rls_policies' as any);
      
      if (!policiesError && policiesData) {
        setPolicies(policiesData);
      }

      // Get tables without RLS
      const { data: tablesData, error: tablesError } = await supabase.rpc('get_tables_without_rls' as any);
      
      if (!tablesError && tablesData) {
        setTablesWithoutRLS(tablesData.map((t: any) => t.tablename));
      }

      // Analyze for issues
      await analyzeRLSIssues();
      
    } catch (error) {
      console.error('Error loading RLS data:', error);
      toast.error('Erro ao carregar dados de RLS');
    } finally {
      setLoading(false);
    }
  };

  const analyzeRLSIssues = async () => {
    setScanning(true);
    try {
      const foundIssues: RLSIssue[] = [];

      // Check for tables without RLS
      const { data: publicTables } = await supabase
        .from('information_schema.tables' as any)
        .select('table_name')
        .eq('table_schema', 'public')
        .not('table_name', 'like', 'pg_%');

      if (publicTables) {
        publicTables.forEach((table: any) => {
          const hasRLS = policies.some(p => p.tablename === table.table_name);
          if (!hasRLS && !table.table_name.startsWith('_')) {
            foundIssues.push({
              severity: 'critical',
              table: table.table_name,
              issue: 'RLS não habilitado',
              recommendation: `Execute: ALTER TABLE ${table.table_name} ENABLE ROW LEVEL SECURITY;`
            });
          }
        });
      }

      // Check for overly permissive policies (using true or similar)
      policies.forEach(policy => {
        const qualLower = policy.qual?.toLowerCase() || '';
        const withCheckLower = policy.with_check?.toLowerCase() || '';
        
        if (qualLower.includes('true') || qualLower === '(true)') {
          foundIssues.push({
            severity: 'high',
            table: policy.tablename,
            policy_name: policy.policyname,
            issue: 'Política muito permissiva (USING true)',
            recommendation: 'Restrinja o acesso com condições específicas baseadas em auth.uid() ou roles'
          });
        }

        if (withCheckLower.includes('true') || withCheckLower === '(true)') {
          foundIssues.push({
            severity: 'high',
            table: policy.tablename,
            policy_name: policy.policyname,
            issue: 'Política muito permissiva (WITH CHECK true)',
            recommendation: 'Adicione validações específicas no WITH CHECK'
          });
        }

        // Check for missing WITH CHECK on INSERT/UPDATE
        if ((policy.cmd === 'INSERT' || policy.cmd === 'UPDATE') && !policy.with_check) {
          foundIssues.push({
            severity: 'medium',
            table: policy.tablename,
            policy_name: policy.policyname,
            issue: `${policy.cmd} sem WITH CHECK`,
            recommendation: 'Adicione cláusula WITH CHECK para validar dados inseridos/atualizados'
          });
        }
      });

      setIssues(foundIssues);
    } catch (error) {
      console.error('Error analyzing RLS:', error);
    } finally {
      setScanning(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      critical: { variant: 'destructive', icon: XCircle, label: 'CRÍTICO' },
      high: { variant: 'destructive', icon: AlertTriangle, label: 'ALTO' },
      medium: { variant: 'default', icon: Info, label: 'MÉDIO' },
      low: { variant: 'outline', icon: Info, label: 'BAIXO' }
    };

    const config = variants[severity] || variants.low;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const securityScore = Math.max(0, 100 - (criticalCount * 20 + highCount * 10));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            RLS Security Audit
          </h2>
          <p className="text-muted-foreground">Análise de segurança de políticas Row Level Security</p>
        </div>
        <Button onClick={loadRLSData} disabled={loading || scanning}>
          <RefreshCw className={`w-4 h-4 mr-2 ${(loading || scanning) ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Security Score */}
      <Card className={securityScore >= 80 ? 'border-green-500' : securityScore >= 60 ? 'border-yellow-500' : 'border-red-500'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Score: {securityScore}/100
          </CardTitle>
          <CardDescription>
            {criticalCount} críticos, {highCount} altos - {issues.length} problemas totais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Badge variant="destructive">{criticalCount} Críticos</Badge>
            <Badge variant="destructive">{highCount} Altos</Badge>
            <Badge>{issues.filter(i => i.severity === 'medium').length} Médios</Badge>
            <Badge variant="outline">{issues.filter(i => i.severity === 'low').length} Baixos</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="issues">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Issues ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="policies">
            <FileCode className="w-4 h-4 mr-2" />
            Políticas ({policies.length})
          </TabsTrigger>
          <TabsTrigger value="tables">
            <Lock className="w-4 h-4 mr-2" />
            Tabelas sem RLS ({tablesWithoutRLS.length})
          </TabsTrigger>
        </TabsList>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          {issues.length > 0 ? (
            issues.map((issue, i) => (
              <Alert key={i} variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'default'}>
                <div className="flex items-start gap-3">
                  {getSeverityBadge(issue.severity)}
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      <code className="text-sm">{issue.table}</code>
                      {issue.policy_name && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {issue.policy_name}
                        </Badge>
                      )}
                    </AlertTitle>
                    <AlertDescription className="mt-2 space-y-2">
                      <p><strong>Problema:</strong> {issue.issue}</p>
                      <p><strong>Recomendação:</strong> {issue.recommendation}</p>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-lg font-medium">Nenhum problema encontrado!</p>
                <p className="text-sm text-muted-foreground">Suas políticas RLS estão seguras</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {policies.map((policy, i) => (
                  <div key={i} className="p-4 hover:bg-muted/50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono text-sm font-medium">{policy.tablename}</p>
                        <p className="font-mono text-xs text-muted-foreground">{policy.policyname}</p>
                      </div>
                      <Badge>{policy.cmd}</Badge>
                    </div>
                    <div className="space-y-1 text-xs">
                      {policy.qual && (
                        <p className="font-mono bg-muted p-2 rounded">
                          <strong>USING:</strong> {policy.qual}
                        </p>
                      )}
                      {policy.with_check && (
                        <p className="font-mono bg-muted p-2 rounded">
                          <strong>WITH CHECK:</strong> {policy.with_check}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables without RLS Tab */}
        <TabsContent value="tables" className="space-y-4">
          {tablesWithoutRLS.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção: Tabelas sem RLS</AlertTitle>
              <AlertDescription>
                As seguintes tabelas não têm Row Level Security habilitado:
                <div className="mt-3 space-y-1">
                  {tablesWithoutRLS.map((table, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Unlock className="w-4 h-4" />
                      <code className="text-sm font-mono">{table}</code>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-lg font-medium">Todas as tabelas protegidas!</p>
                <p className="text-sm text-muted-foreground">RLS habilitado em todas as tabelas públicas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
