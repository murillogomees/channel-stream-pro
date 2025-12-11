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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { rlsAuditService, RLSPolicy, RLSIssue } from '@/services/rlsAuditService';

export function RLSAuditPanel() {
  const [policies, setPolicies] = useState<RLSPolicy[]>([]);
  const [issues, setIssues] = useState<RLSIssue[]>([]);
  const [tablesWithoutRLS, setTablesWithoutRLS] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  useEffect(() => {
    loadRLSData();
  }, []);

  const loadRLSData = async () => {
    setLoading(true);
    try {
      // Get all RLS policies
      const policiesData = await rlsAuditService.getAllPolicies();
      setPolicies(policiesData);

      // Get tables without RLS
      const tablesData = await rlsAuditService.getTablesWithoutRLS();
      setTablesWithoutRLS(tablesData);

      // Analyze for issues
      const detectedIssues = rlsAuditService.analyzePolicies(policiesData);
      
      // Add critical issues for tables without RLS
      tablesData.forEach(table => {
        detectedIssues.push({
          severity: 'critical',
          table: table,
          issue: 'RLS não habilitado',
          recommendation: `Execute: ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
        });
      });

      setIssues(detectedIssues);
      
      if (detectedIssues.length > 0) {
        toast.warning(`${detectedIssues.length} problemas de segurança detectados`);
      } else {
        toast.success('Nenhum problema de segurança encontrado!');
      }
      
    } catch (error) {
      console.error('Error loading RLS data:', error);
      toast.error('Erro ao carregar dados de RLS');
    } finally {
      setLoading(false);
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

  const fixTableRLS = async (tableName: string) => {
    setFixing(tableName);
    try {
      // Create migration to enable RLS on the table
      const sql = `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`;
      
      toast.info(`Execute a seguinte migration:\n${sql}`);
      
    } catch (error) {
      console.error('Error fixing RLS:', error);
      toast.error('Erro ao corrigir RLS');
    } finally {
      setFixing(null);
    }
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
        <Button onClick={loadRLSData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Scan
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
                  <div className="flex-1 space-y-2">
                    <AlertTitle className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm">{issue.table}</code>
                      {issue.policy_name && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {issue.policy_name}
                        </Badge>
                      )}
                    </AlertTitle>
                    <AlertDescription className="space-y-3">
                      <div>
                        <strong className="text-foreground">Problema:</strong> {issue.issue}
                      </div>
                      <div>
                        <strong className="text-foreground">Recomendação:</strong> {issue.recommendation}
                      </div>
                      {issue.policy_definition && (
                        <div className="mt-2">
                          <strong className="text-foreground">Definição atual:</strong>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {issue.policy_definition}
                          </pre>
                        </div>
                      )}
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
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>⚠️ Atenção Crítica: Tabelas sem RLS</AlertTitle>
                <AlertDescription>
                  As seguintes tabelas não têm Row Level Security habilitado e estão TOTALMENTE EXPOSTAS:
                </AlertDescription>
              </Alert>
              
              {tablesWithoutRLS.map((table, i) => (
                <Card key={i} className="border-red-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Unlock className="w-5 h-5 text-red-500" />
                        <div>
                          <code className="text-sm font-mono font-medium">{table}</code>
                          <p className="text-xs text-muted-foreground mt-1">
                            Todos os dados desta tabela estão acessíveis sem restrição
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={fixing === table}
                        onClick={() => {
                          toast.info(
                            `Para corrigir ${table}, execute:\nALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
                            { duration: 8000 }
                          );
                        }}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Ver SQL
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-lg font-medium">✅ Todas as tabelas protegidas!</p>
                <p className="text-sm text-muted-foreground">RLS habilitado em todas as tabelas públicas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
