/**
 * Interactive RLS Audit Panel - Security Analysis with One-Click Actions
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  FileCode,
  Lock,
  Unlock,
  Search,
  Filter,
  Download,
  Wand2,
  Clock,
  Eye,
  EyeOff,
  BarChart3,
  Sparkles
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { rlsAuditService, RLSPolicy, RLSIssue } from '@/services/rlsAuditService';
import { RLSIssueCard, RLSIssueWithResolution } from './RLSIssueCard';

interface Resolution {
  id: string;
  issue_hash: string;
  table_name: string;
  policy_name: string | null;
  issue_type: string;
  status: string;
  resolution_notes: string | null;
  suggested_fix: string | null;
}

export function InteractiveRLSAuditPanel() {
  const [policies, setPolicies] = useState<RLSPolicy[]>([]);
  const [issues, setIssues] = useState<RLSIssueWithResolution[]>([]);
  const [tablesWithoutRLS, setTablesWithoutRLS] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bulkFixing, setBulkFixing] = useState(false);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, []);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('rls-audit-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rls_audit_resolutions'
        },
        (payload) => {
          console.log('[RLS Audit] Realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as Resolution;
            
            // Update resolutions state
            setResolutions(prev => {
              const exists = prev.find(r => r.id === updated.id);
              if (exists) {
                return prev.map(r => r.id === updated.id ? updated : r);
              }
              return [...prev, updated];
            });
            
            // Update issues state with new resolution data
            setIssues(prev => prev.map(issue => {
              const hash = `${issue.table}:${issue.policy_name || 'no-policy'}:${issue.issue}`.replace(/\s+/g, '-').toLowerCase();
              if (hash === updated.issue_hash) {
                return {
                  ...issue,
                  id: updated.id,
                  status: updated.status as any,
                  resolution_notes: updated.resolution_notes || undefined,
                  suggested_fix: updated.suggested_fix || undefined
                };
              }
              return issue;
            }));
          }
          
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Resolution;
            setResolutions(prev => prev.filter(r => r.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load policies, tables without RLS, and existing resolutions in parallel
      const [policiesData, tablesData, resolutionsData] = await Promise.all([
        rlsAuditService.getAllPolicies().catch(() => []),
        rlsAuditService.getTablesWithoutRLS().catch(() => []),
        loadResolutions()
      ]);

      setPolicies(policiesData);
      setTablesWithoutRLS(tablesData);
      setResolutions(resolutionsData);

      // Analyze for issues
      const detectedIssues: RLSIssueWithResolution[] = rlsAuditService.analyzePolicies(policiesData);
      
      // Add critical issues for tables without RLS
      tablesData.forEach(table => {
        detectedIssues.push({
          severity: 'critical',
          table: table,
          issue: 'RLS não habilitado',
          recommendation: `Execute: ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
        });
      });

      // Merge with existing resolutions
      const issuesWithResolutions = detectedIssues.map(issue => {
        const hash = generateIssueHash(issue);
        const resolution = resolutionsData.find(r => r.issue_hash === hash);
        return {
          ...issue,
          id: resolution?.id,
          status: (resolution?.status as any) || 'pending',
          resolution_notes: resolution?.resolution_notes || undefined,
          suggested_fix: resolution?.suggested_fix || undefined
        };
      });

      setIssues(issuesWithResolutions);
      
      const pendingCount = issuesWithResolutions.filter(i => 
        !['resolved', 'ignored', 'false_positive'].includes(i.status || 'pending')
      ).length;

      if (pendingCount > 0) {
        toast.warning(`${pendingCount} problemas de segurança pendentes`);
      } else {
        toast.success('Nenhum problema pendente!');
      }
      
    } catch (error) {
      console.error('Error loading RLS data:', error);
      toast.error('Erro ao carregar dados de RLS');
    } finally {
      setLoading(false);
    }
  };

  const loadResolutions = async (): Promise<Resolution[]> => {
    const { data, error } = await supabase
      .from('rls_audit_resolutions')
      .select('*');
    
    if (error) {
      console.error('Error loading resolutions:', error);
      return [];
    }
    return data || [];
  };

  const generateIssueHash = (issue: RLSIssue | RLSIssueWithResolution) => {
    return `${issue.table}:${issue.policy_name || 'no-policy'}:${issue.issue}`.replace(/\s+/g, '-').toLowerCase();
  };

  const handleStatusChange = async (issue: RLSIssueWithResolution, status: string, notes?: string) => {
    const hash = generateIssueHash(issue);
    
    try {
      const { data: existing } = await supabase
        .from('rls_audit_resolutions')
        .select('id')
        .eq('issue_hash', hash)
        .single();

      if (existing) {
        // Update existing
        await supabase
          .from('rls_audit_resolutions')
          .update({
            status,
            resolution_notes: notes || null,
            resolved_at: ['resolved', 'ignored', 'false_positive'].includes(status) ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert new
        await supabase
          .from('rls_audit_resolutions')
          .insert({
            issue_hash: hash,
            table_name: issue.table,
            policy_name: issue.policy_name || null,
            issue_type: issue.issue,
            issue_description: issue.recommendation,
            severity: issue.severity,
            status,
            resolution_notes: notes || null,
            resolved_at: ['resolved', 'ignored', 'false_positive'].includes(status) ? new Date().toISOString() : null
          });
      }

      // Update local state
      setIssues(prev => prev.map(i => 
        generateIssueHash(i) === hash 
          ? { ...i, status: status as any, resolution_notes: notes }
          : i
      ));

      toast.success(`Status atualizado para: ${status}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleApplyFix = async (issue: RLSIssueWithResolution) => {
    if (!issue.suggested_fix) {
      toast.error('Nenhum SQL de correção disponível');
      return;
    }

    try {
      // Call the rls-fix edge function to actually apply the fix
      const { data, error } = await supabase.functions.invoke('rls-fix', {
        body: {
          confirm: true,
          sql_apply: issue.suggested_fix,
          severity: issue.severity,
          schema_name: 'public',
          table_name: issue.table,
          policy_name: issue.policy_name || null,
          issue_id: issue.id || `${issue.table}-${Date.now()}`
        }
      });

      if (error) {
        console.error('Error applying fix:', error);
        toast.error(`Erro ao aplicar fix: ${error.message}`);
        await handleStatusChange(issue, 'in_progress', `Falha ao aplicar: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success('Fix aplicado com sucesso!');
        await handleStatusChange(issue, 'resolved', `Aplicado automaticamente. Backup ID: ${data.backup_id || 'N/A'}`);
        // Reload data to reflect changes
        loadAllData();
      } else if (data?.error) {
        toast.error(`Erro: ${data.error}`);
        await handleStatusChange(issue, 'in_progress', data.error);
      }
    } catch (err: any) {
      console.error('Exception applying fix:', err);
      toast.error(`Exceção: ${err.message}`);
      
      // Fallback: copy to clipboard
      if (issue.suggested_fix) {
        await navigator.clipboard.writeText(issue.suggested_fix);
        toast.info('SQL copiado para clipboard como fallback', { duration: 3000 });
      }
      await handleStatusChange(issue, 'in_progress', 'Falha na aplicação automática - SQL copiado para aplicação manual');
    }
  };

  const handleBulkAcknowledge = async () => {
    const pending = issues.filter(i => i.status === 'pending' || !i.status);
    
    for (const issue of pending) {
      await handleStatusChange(issue, 'acknowledged');
    }
    
    toast.success(`${pending.length} issues reconhecidas`);
  };

  const handleExportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_issues: issues.length,
        pending: pendingIssues.length,
        in_progress: stats.inProgressIssues.length,
        resolved: resolvedIssues.length,
        security_score: securityScore
      },
      issues: issues.map(i => ({
        table: i.table,
        policy: i.policy_name,
        severity: i.severity,
        issue: i.issue,
        recommendation: i.recommendation,
        status: i.status || 'pending',
        suggested_fix: i.suggested_fix
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rls-security-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  };

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch = !searchTerm || 
        issue.table.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (issue.policy_name?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'pending' && (!issue.status || issue.status === 'pending')) ||
        issue.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [issues, searchTerm, severityFilter, statusFilter]);

  // Calculate stats with useMemo for performance
  const stats = useMemo(() => {
    const pendingIssues = issues.filter(i => !i.status || i.status === 'pending' || i.status === 'acknowledged' || i.status === 'in_progress');
    const resolvedIssues = issues.filter(i => i.status === 'resolved' || i.status === 'ignored' || i.status === 'false_positive');
    const inProgressIssues = issues.filter(i => i.status === 'in_progress');
    
    const criticalTotal = issues.filter(i => i.severity === 'critical').length;
    const criticalPending = pendingIssues.filter(i => i.severity === 'critical').length;
    const criticalResolved = resolvedIssues.filter(i => i.severity === 'critical').length;
    
    const highTotal = issues.filter(i => i.severity === 'high').length;
    const highPending = pendingIssues.filter(i => i.severity === 'high').length;
    const highResolved = resolvedIssues.filter(i => i.severity === 'high').length;
    
    const mediumPending = pendingIssues.filter(i => i.severity === 'medium').length;
    
    // Security score calculation based on severity weights
    // Start at 100, deduct points for unresolved issues
    const maxDeduction = criticalTotal * 20 + highTotal * 10 + issues.filter(i => i.severity === 'medium').length * 5;
    const currentDeduction = criticalPending * 20 + highPending * 10 + mediumPending * 5;
    const securityScore = maxDeduction > 0 
      ? Math.round(100 - (currentDeduction / maxDeduction) * 100)
      : 100;
    
    const progressPercent = issues.length > 0 ? (resolvedIssues.length / issues.length) * 100 : 100;

    return {
      pendingIssues,
      resolvedIssues,
      inProgressIssues,
      criticalPending,
      criticalResolved,
      highPending,
      highResolved,
      securityScore: Math.max(0, Math.min(100, securityScore)),
      progressPercent
    };
  }, [issues]);

  const { pendingIssues, resolvedIssues, criticalPending, highPending, securityScore, progressPercent } = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            RLS Security Audit
          </h2>
          <p className="text-muted-foreground">Análise interativa com correções de um clique</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleExportReport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleBulkAcknowledge} variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            Reconhecer Todos
          </Button>
          <Button onClick={loadAllData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Scan
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={securityScore >= 80 ? 'border-green-500' : securityScore >= 60 ? 'border-yellow-500' : 'border-red-500'}>
          <CardHeader className="pb-2">
            <CardDescription>Security Score</CardDescription>
            <CardTitle className="text-3xl">{securityScore}/100</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={securityScore} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Progresso</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {resolvedIssues.length}/{issues.length}
              <Badge variant="secondary" className="text-xs">{Math.round(progressPercent)}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border-red-500/50">
          <CardHeader className="pb-2">
            <CardDescription>Pendentes Críticos</CardDescription>
            <CardTitle className="text-3xl text-red-500">{criticalPending}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="destructive">{criticalPending} críticos</Badge>
              <Badge variant="outline">{highPending} altos</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tabelas sem RLS</CardDescription>
            <CardTitle className="text-3xl">{tablesWithoutRLS.length}</CardTitle>
          </CardHeader>
          <CardContent>
            {tablesWithoutRLS.length > 0 ? (
              <Badge variant="destructive">Expostas</Badge>
            ) : (
              <Badge variant="outline" className="bg-green-500/10 text-green-500">Protegidas</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tabela, política ou issue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="acknowledged">Reconhecido</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
                <SelectItem value="ignored">Ignorado</SelectItem>
                <SelectItem value="false_positive">Falso Positivo</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary">
              {filteredIssues.length} resultados
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="issues" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Issues ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-2">
            <FileCode className="w-4 h-4" />
            Políticas ({policies.length})
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-2">
            <Lock className="w-4 h-4" />
            Tabelas sem RLS ({tablesWithoutRLS.length})
          </TabsTrigger>
        </TabsList>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          {filteredIssues.length > 0 ? (
            filteredIssues.map((issue, i) => (
              <RLSIssueCard
                key={`${issue.table}-${issue.policy_name}-${i}`}
                issue={issue}
                onStatusChange={handleStatusChange}
                onApplyFix={handleApplyFix}
              />
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-lg font-medium">
                  {issues.length === 0 ? 'Nenhum problema encontrado!' : 'Nenhum resultado para os filtros'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {issues.length === 0 ? 'Suas políticas RLS estão seguras' : 'Tente ajustar os filtros'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y max-h-[600px] overflow-y-auto">
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
                        onClick={() => {
                          const sql = `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`;
                          navigator.clipboard.writeText(sql);
                          toast.success('SQL copiado para clipboard!');
                        }}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Copiar Fix
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
