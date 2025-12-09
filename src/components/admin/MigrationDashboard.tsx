/**
 * Migration Dashboard - Fase 8 Migration Management
 * 
 * Admin interface for managing feature flags, migrations, and rollbacks.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Flag, 
  Play, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Database,
  Trash2,
  RefreshCw,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { migrationService, MigrationFlag } from '@/services/migrationService';

interface FeatureFlagRow {
  id: string;
  flag_name: string;
  enabled: boolean;
  percentage: number;
  description: string | null;
  updated_at: string;
}

interface MigrationAuditRow {
  id: string;
  migration_name: string;
  executed_at: string;
  status: string;
  duration_ms: number | null;
  rows_affected: number | null;
  error_message: string | null;
}

interface CleanupPreview {
  table_name: string;
  rows_deleted: number;
  action: string;
}

export function MigrationDashboard() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<MigrationAuditRow[]>([]);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null);
  const [runningCleanup, setRunningCleanup] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load feature flags
      const { data: flagsData, error: flagsError } = await supabase
        .from('feature_flag_config')
        .select('*')
        .order('flag_name');

      if (flagsError) throw flagsError;
      setFlags(flagsData || []);

      // Load migration audit logs
      const { data: auditData, error: auditError } = await supabase
        .from('migration_audit')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(20);

      if (auditError) throw auditError;
      setAuditLogs(auditData || []);

      // Get cleanup preview (dry run)
      const { data: cleanupData, error: cleanupError } = await supabase
        .rpc('cleanup_fase8_old_data', { p_dry_run: true });

      if (!cleanupError && cleanupData && Array.isArray(cleanupData)) {
        setCleanupPreview(cleanupData as unknown as CleanupPreview[]);
      }
    } catch (error) {
      console.error('Error loading migration data:', error);
      toast.error('Erro ao carregar dados de migração');
    } finally {
      setLoading(false);
    }
  };

  const toggleFlag = async (flagName: string, enabled: boolean, percentage?: number) => {
    setUpdatingFlag(flagName);
    try {
      const { error } = await supabase
        .from('feature_flag_config')
        .update({ 
          enabled, 
          percentage: percentage ?? (enabled ? 100 : 0),
          updated_at: new Date().toISOString() 
        })
        .eq('flag_name', flagName);

      if (error) throw error;

      // Update local state
      migrationService.updateMigrationFlag(flagName as MigrationFlag, {
        enabled,
        percentage: percentage ?? (enabled ? 100 : 0),
      });

      toast.success(`Flag ${flagName} ${enabled ? 'ativada' : 'desativada'}`);
      await loadData();
    } catch (error) {
      console.error('Error toggling flag:', error);
      toast.error('Erro ao atualizar flag');
    } finally {
      setUpdatingFlag(null);
    }
  };

  const updatePercentage = async (flagName: string, percentage: number) => {
    setUpdatingFlag(flagName);
    try {
      const { error } = await supabase
        .from('feature_flag_config')
        .update({ 
          percentage, 
          enabled: percentage > 0,
          updated_at: new Date().toISOString() 
        })
        .eq('flag_name', flagName);

      if (error) throw error;

      migrationService.updateMigrationFlag(flagName as MigrationFlag, {
        percentage,
        enabled: percentage > 0,
      });

      toast.success(`Rollout de ${flagName} atualizado para ${percentage}%`);
      await loadData();
    } catch (error) {
      console.error('Error updating percentage:', error);
      toast.error('Erro ao atualizar percentual');
    } finally {
      setUpdatingFlag(null);
    }
  };

  const runCleanup = async (dryRun: boolean = true) => {
    setRunningCleanup(true);
    try {
      const { data, error } = await supabase
        .rpc('cleanup_fase8_old_data', { p_dry_run: dryRun });

      if (error) throw error;

      if (dryRun) {
        setCleanupPreview(Array.isArray(data) ? data as unknown as CleanupPreview[] : []);
        toast.info('Preview de limpeza atualizado');
      } else {
        toast.success('Limpeza executada com sucesso!');
        await loadData();
      }
    } catch (error) {
      console.error('Error running cleanup:', error);
      toast.error('Erro ao executar limpeza');
    } finally {
      setRunningCleanup(false);
    }
  };

  const emergencyStop = () => {
    migrationService.emergencyStop();
    toast.warning('⚠️ Emergency Stop executado - todas as flags de migração desativadas');
    loadData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'rolled_back':
        return <Badge className="bg-yellow-500"><RotateCcw className="w-3 h-3 mr-1" />Rolled Back</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
    }
  };

  const totalRowsToClean = cleanupPreview.reduce((sum, item) => sum + item.rows_deleted, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Migration Dashboard</h2>
          <p className="text-muted-foreground">Fase 8 - Cleanup, Consolidation & Migration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" onClick={emergencyStop}>
            <Shield className="w-4 h-4 mr-2" />
            Emergency Stop
          </Button>
        </div>
      </div>

      {/* Warning Alert */}
      <Alert variant="destructive" className="border-yellow-500 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Alterações nas feature flags podem afetar usuários em produção. 
          Use o rollout progressivo (5% → 25% → 100%) para migrações seguras.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">
            <Flag className="w-4 h-4 mr-2" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="cleanup">
            <Trash2 className="w-4 h-4 mr-2" />
            Data Cleanup
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Database className="w-4 h-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Feature Flags Tab */}
        <TabsContent value="flags" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {flags.map((flag) => (
              <Card key={flag.id} className={flag.enabled ? 'border-green-500/50' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-mono">{flag.flag_name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {flag.description || 'Sem descrição'}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      disabled={updatingFlag === flag.flag_name}
                      onCheckedChange={(checked) => toggleFlag(flag.flag_name, checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Rollout</span>
                      <span className="text-sm font-medium">{flag.percentage}%</span>
                    </div>
                    <Slider
                      value={[flag.percentage]}
                      max={100}
                      step={5}
                      disabled={updatingFlag === flag.flag_name}
                      onValueCommit={(value) => updatePercentage(flag.flag_name, value[0])}
                      className="w-full"
                    />
                    <Progress value={flag.percentage} className="h-1" />
                    
                    {/* Quick rollout buttons */}
                    <div className="flex gap-1">
                      {[5, 25, 50, 100].map((pct) => (
                        <Button
                          key={pct}
                          variant={flag.percentage === pct ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 text-xs"
                          disabled={updatingFlag === flag.flag_name}
                          onClick={() => updatePercentage(flag.flag_name, pct)}
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Data Cleanup Tab */}
        <TabsContent value="cleanup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Data Cleanup Preview
              </CardTitle>
              <CardDescription>
                Preview de dados antigos que podem ser removidos com segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cleanupPreview.length > 0 ? (
                  <>
                    <div className="rounded-lg border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left text-sm font-medium">Tabela</th>
                            <th className="p-3 text-right text-sm font-medium">Registros</th>
                            <th className="p-3 text-right text-sm font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cleanupPreview.map((item, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="p-3 font-mono text-sm">{item.table_name}</td>
                              <td className="p-3 text-right text-sm">
                                {item.rows_deleted.toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <Badge variant={item.action === 'dry_run' ? 'outline' : 'default'}>
                                  {item.action}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/50">
                            <td className="p-3 font-medium">Total</td>
                            <td className="p-3 text-right font-medium">
                              {totalRowsToClean.toLocaleString()}
                            </td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => runCleanup(true)}
                        disabled={runningCleanup}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${runningCleanup ? 'animate-spin' : ''}`} />
                        Atualizar Preview
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Confirma exclusão de ${totalRowsToClean.toLocaleString()} registros?`)) {
                            runCleanup(false);
                          }
                        }}
                        disabled={runningCleanup || totalRowsToClean === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Executar Limpeza
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado antigo para limpar
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Migration Audit Log
              </CardTitle>
              <CardDescription>
                Histórico de execução de migrações e alterações de flags
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusBadge(log.status)}
                        <div>
                          <p className="font-mono text-sm">{log.migration_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.executed_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {log.duration_ms && (
                          <p className="text-muted-foreground">{log.duration_ms}ms</p>
                        )}
                        {log.rows_affected !== null && (
                          <p className="text-muted-foreground">{log.rows_affected} rows</p>
                        )}
                        {log.error_message && (
                          <p className="text-red-500 text-xs truncate max-w-[200px]">
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log de migração encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MigrationDashboard;
