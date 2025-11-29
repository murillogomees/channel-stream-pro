import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings2, 
  Cloud, 
  Server, 
  Zap,
  RefreshCw,
  Loader2,
  TrendingUp,
  Activity,
  Shield,
  Globe,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getStreamingPolicies, 
  updateStreamingPolicy,
  getChannelOverrides,
  StreamingPolicy,
  ChannelRoutingOverride,
  StreamingStrategy
} from '@/services/streamingPolicyService';
import { supabase } from '@/integrations/supabase/client';

interface StreamingMetricSummary {
  metric_type: string;
  total_value: number;
  count: number;
  last_recorded: string;
}

export function StreamingPolicyDashboard() {
  const [policies, setPolicies] = useState<StreamingPolicy[]>([]);
  const [overrides, setOverrides] = useState<ChannelRoutingOverride[]>([]);
  const [metrics, setMetrics] = useState<StreamingMetricSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [policiesData, overridesData] = await Promise.all([
        getStreamingPolicies(),
        getChannelOverrides()
      ]);

      setPolicies(policiesData);
      setOverrides(overridesData);

      // Load metrics summary
      const { data: metricsData } = await supabase
        .from('streaming_metrics')
        .select('metric_type, value, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(1000);

      if (metricsData) {
        // Aggregate metrics
        const aggregated = metricsData.reduce((acc, m) => {
          if (!acc[m.metric_type]) {
            acc[m.metric_type] = { total: 0, count: 0, last: m.recorded_at };
          }
          acc[m.metric_type].total += Number(m.value);
          acc[m.metric_type].count += 1;
          return acc;
        }, {} as Record<string, { total: number; count: number; last: string }>);

        setMetrics(Object.entries(aggregated).map(([type, data]) => ({
          metric_type: type,
          total_value: data.total,
          count: data.count,
          last_recorded: data.last
        })));
      }
    } catch (error) {
      console.error('Error loading policy data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTogglePolicy = async (policy: StreamingPolicy) => {
    setSaving(policy.id);
    try {
      const success = await updateStreamingPolicy(policy.id, { 
        is_active: !policy.is_active 
      });
      
      if (success) {
        setPolicies(prev => prev.map(p => 
          p.id === policy.id ? { ...p, is_active: !p.is_active } : p
        ));
        toast.success(`Política ${!policy.is_active ? 'ativada' : 'desativada'}`);
      } else {
        toast.error('Erro ao atualizar política');
      }
    } finally {
      setSaving(null);
    }
  };

  const handleStrategyChange = async (policy: StreamingPolicy, strategy: string) => {
    setSaving(policy.id);
    try {
      const success = await updateStreamingPolicy(policy.id, { strategy });
      
      if (success) {
        setPolicies(prev => prev.map(p => 
          p.id === policy.id ? { ...p, strategy: strategy as StreamingStrategy } : p
        ));
        toast.success('Estratégia atualizada');
      } else {
        toast.error('Erro ao atualizar estratégia');
      }
    } finally {
      setSaving(null);
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'USE_STREAM':
        return <Cloud className="w-4 h-4 text-orange-400" />;
      case 'USE_ORIGIN':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'STREAM_ON_DEMAND':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'vod': return 'VOD (Filmes/Séries)';
      case 'live_linear': return 'Live (TV Linear)';
      case 'agile': return 'Ágil (Promos/Temp)';
      case 'unknown': return 'Desconhecido';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Layers className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Policy Engine</h2>
            <p className="text-sm text-muted-foreground">
              Roteamento híbrido de streaming
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Políticas Ativas</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-400" />
              {policies.filter(p => p.is_active).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              de {policies.length} políticas totais
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overrides Ativos</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              {overrides.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              canais com roteamento personalizado
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Requisições (24h)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              {metrics.find(m => m.metric_type === 'request')?.total_value.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              via edge router
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Métricas Coletadas</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-400" />
              {metrics.reduce((acc, m) => acc + m.count, 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              pontos de dados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Políticas Globais</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Políticas por Tipo de Conteúdo</CardTitle>
              <CardDescription>
                Define a estratégia padrão de roteamento para cada tipo de conteúdo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {policies.map(policy => (
                  <div 
                    key={policy.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      policy.is_active ? 'bg-muted/50' : 'bg-muted/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Switch 
                        checked={policy.is_active}
                        onCheckedChange={() => handleTogglePolicy(policy)}
                        disabled={saving === policy.id}
                      />
                      <div>
                        <p className="font-medium">{getContentTypeLabel(policy.content_type)}</p>
                        <p className="text-xs text-muted-foreground">
                          Prioridade: {policy.priority}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Select
                        value={policy.strategy}
                        onValueChange={(value) => handleStrategyChange(policy, value)}
                        disabled={saving === policy.id || !policy.is_active}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USE_STREAM">
                            <div className="flex items-center gap-2">
                              <Cloud className="w-4 h-4 text-orange-400" />
                              Cloudflare Stream
                            </div>
                          </SelectItem>
                          <SelectItem value="USE_ORIGIN">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-blue-400" />
                              Origin Direto
                            </div>
                          </SelectItem>
                          <SelectItem value="STREAM_ON_DEMAND">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-400" />
                              Stream On-Demand
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {saving === policy.id && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}

                      <Badge variant="outline" className="gap-1">
                        {getStrategyIcon(policy.strategy)}
                        {policy.strategy.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overrides por Canal</CardTitle>
              <CardDescription>
                Canais com roteamento personalizado que sobrescreve a política padrão
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overrides.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum override configurado
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {overrides.map(override => (
                      <div 
                        key={override.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium font-mono">
                            {override.channel_id}
                          </p>
                          {override.reason && (
                            <p className="text-xs text-muted-foreground">{override.reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {override.force_origin && (
                            <Badge variant="destructive" className="text-xs">Forçar Origin</Badge>
                          )}
                          <Badge variant="outline" className="gap-1">
                            {getStrategyIcon(override.strategy)}
                            {override.strategy}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Métricas de Streaming</CardTitle>
              <CardDescription>
                Dados coletados pelo edge router e policy engine
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma métrica coletada ainda
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {metrics.map(metric => (
                    <Card key={metric.metric_type}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground capitalize">
                              {metric.metric_type.replace('_', ' ')}
                            </p>
                            <p className="text-2xl font-bold">
                              {metric.total_value.toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {metric.count} registros
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default StreamingPolicyDashboard;
