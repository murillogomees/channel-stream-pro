/**
 * Migration Dashboard - Simplified
 * Admin interface for managing feature flags and migrations.
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
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Database,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface FeatureFlagRow {
  id: string;
  flag_name: string;
  enabled: boolean;
  percentage: number | null;
  description: string | null;
  updated_at: string | null;
}

interface MigrationAuditRow {
  id: string;
  migration_name: string;
  executed_at: string | null;
  status: string | null;
  duration_ms: number | null;
  rows_affected: number | null;
  error_message: string | null;
}

export function MigrationDashboard() {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<MigrationAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null);

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

      toast.success(`Rollout de ${flagName} atualizado para ${percentage}%`);
      await loadData();
    } catch (error) {
      console.error('Error updating percentage:', error);
      toast.error('Erro ao atualizar percentual');
    } finally {
      setUpdatingFlag(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Migration Dashboard</h2>
          <p className="text-muted-foreground">Gerenciamento de Feature Flags e Migrações</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Warning Alert */}
      <Alert variant="destructive" className="border-yellow-500 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Alterações nas feature flags podem afetar usuários em produção.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">
            <Flag className="w-4 h-4 mr-2" />
            Feature Flags
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
                      <span className="text-sm font-medium">{flag.percentage || 0}%</span>
                    </div>
                    <Slider
                      value={[flag.percentage || 0]}
                      max={100}
                      step={5}
                      disabled={updatingFlag === flag.flag_name}
                      onValueCommit={(value) => updatePercentage(flag.flag_name, value[0])}
                      className="w-full"
                    />
                    <Progress value={flag.percentage || 0} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
                Histórico de execução de migrações
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
                            {log.executed_at ? new Date(log.executed_at).toLocaleString('pt-BR') : '-'}
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
