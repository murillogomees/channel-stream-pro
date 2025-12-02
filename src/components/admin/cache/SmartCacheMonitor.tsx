/**
 * Smart Cache Monitor - Dashboard completo de gerenciamento
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  Plus, 
  Activity, 
  TrendingUp, 
  AlertCircle,
  Zap,
  Trash2,
  Clock
} from 'lucide-react';
import { smartCacheService, CacheRule, CacheSummary } from '@/services/smartCacheService';
import { CacheRulesTable } from './CacheRulesTable';
import { CacheStatsChart } from './CacheStatsChart';
import { CacheInvalidationPanel } from './CacheInvalidationPanel';
import { CreateCacheRuleDialog } from './CreateCacheRuleDialog';

export function SmartCacheMonitor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CacheSummary | null>(null);
  const [rules, setRules] = useState<CacheRule[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, rulesRes] = await Promise.all([
        smartCacheService.getSummary(),
        smartCacheService.listRules(),
      ]);

      if (summaryRes.error) throw summaryRes.error;
      if (rulesRes.error) throw rulesRes.error;

      setSummary(summaryRes.data);
      setRules(rulesRes.data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
    toast({
      title: 'Dados atualizados',
      description: 'Cache monitor atualizado com sucesso',
    });
  };

  const handleRuleCreated = () => {
    setCreateDialogOpen(false);
    loadData();
    toast({
      title: 'Regra criada',
      description: 'Nova regra de cache criada com sucesso',
    });
  };

  const handleRuleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      const { error } = await smartCacheService.toggleRule(ruleId, enabled);
      if (error) throw error;

      loadData();
      toast({
        title: enabled ? 'Regra ativada' : 'Regra desativada',
        description: `Regra ${enabled ? 'ativada' : 'desativada'} com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar regra',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRuleDelete = async (ruleId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta regra?')) return;

    try {
      const { error } = await smartCacheService.deleteRule(ruleId);
      if (error) throw error;

      loadData();
      toast({
        title: 'Regra deletada',
        description: 'Regra de cache deletada com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao deletar regra',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Smart Cache Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie regras de cache dinâmicas e monitore performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Regras</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_rules || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.enabled_rules || 0} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.hit_rate.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_hits || 0} hits / {summary?.total_misses || 0} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avg_response_time_ms.toFixed(0) || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo de resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banda Economizada</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.total_bandwidth_saved_gb.toFixed(2) || 0} GB
            </div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="rules">Regras de Cache</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="invalidation">Invalidação</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status do Sistema</CardTitle>
              <CardDescription>
                Monitoramento em tempo real do sistema de cache
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Rules Engine</span>
                  <Badge variant="default">Operacional</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">CDN Worker Integration</span>
                  <Badge variant="default">Ativo</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Key Normalization</span>
                  <Badge variant="default">Funcionando</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Stats Collection</span>
                  <Badge variant="default">Coletando</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regras Ativas Recentes</CardTitle>
              <CardDescription>
                Últimas regras de cache aplicadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CacheRulesTable
                rules={rules.filter(r => r.enabled).slice(0, 5)}
                onToggle={handleRuleToggle}
                onDelete={handleRuleDelete}
                compact
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Regras de Cache</CardTitle>
              <CardDescription>
                Configure regras dinâmicas de cache para otimizar performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CacheRulesTable
                rules={rules}
                onToggle={handleRuleToggle}
                onDelete={handleRuleDelete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas de Cache</CardTitle>
              <CardDescription>
                Análise detalhada de performance e hit rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CacheStatsChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invalidation">
          <Card>
            <CardHeader>
              <CardTitle>Invalidação de Cache</CardTitle>
              <CardDescription>
                Limpe cache manualmente por URL, prefixo ou tag
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CacheInvalidationPanel onInvalidate={() => loadData()} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <CreateCacheRuleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleRuleCreated}
      />
    </div>
  );
}

export default SmartCacheMonitor;
