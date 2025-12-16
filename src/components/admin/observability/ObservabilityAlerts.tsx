/**
 * ObservabilityAlerts - Automatic alerts configuration
 */

import { useState, useEffect } from "react";
import { useObservability } from "@/hooks/useObservability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bell, AlertTriangle, CheckCircle, Settings, Save } from "lucide-react";
import { toast } from "sonner";

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  enabled: boolean;
  triggered: boolean;
  lastTriggered?: Date;
}

const DEFAULT_RULES: AlertRule[] = [
  { id: '1', name: 'Latência Alta', metric: 'avgLatency', operator: 'gt', threshold: 500, enabled: true, triggered: false },
  { id: '2', name: 'Taxa de Erro', metric: 'errorRate', operator: 'gt', threshold: 5, enabled: true, triggered: false },
  { id: '3', name: 'Buffer Alto', metric: 'avgBufferEvents', operator: 'gt', threshold: 3, enabled: true, triggered: false },
  { id: '4', name: 'Canais Unhealthy', metric: 'unhealthyChannels', operator: 'gt', threshold: 10, enabled: true, triggered: false },
  { id: '5', name: 'Sistema Degradado', metric: 'systemStatus', operator: 'eq', threshold: 1, enabled: true, triggered: false },
];

export default function ObservabilityAlerts() {
  const { metrics, health } = useObservability({ autoRefresh: true, refreshInterval: 30000 });
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_RULES);
  const [alerts, setAlerts] = useState<{ rule: AlertRule; value: number; timestamp: Date }[]>([]);
  const [editingRule, setEditingRule] = useState<string | null>(null);

  // Check alerts whenever metrics/health update
  useEffect(() => {
    if (!metrics && !health) return;

    const newAlerts: { rule: AlertRule; value: number; timestamp: Date }[] = [];

    rules.forEach(rule => {
      if (!rule.enabled) return;

      let currentValue: number | undefined;
      
      // Map metric to actual value
      switch (rule.metric) {
        case 'avgLatency':
          currentValue = metrics?.streaming?.avgLatency;
          break;
        case 'errorRate':
          // Calculate from performance data if available
          currentValue = 0;
          break;
        case 'avgBufferEvents':
          currentValue = metrics?.overview?.avgBufferEvents;
          break;
        case 'unhealthyChannels':
          currentValue = metrics?.overview?.totalChannels && metrics?.overview?.healthyChannels
            ? metrics.overview.totalChannels - metrics.overview.healthyChannels
            : 0;
          break;
        case 'systemStatus':
          currentValue = health?.status === 'unhealthy' ? 2 : health?.status === 'degraded' ? 1 : 0;
          break;
      }

      if (currentValue === undefined) return;

      let triggered = false;
      switch (rule.operator) {
        case 'gt': triggered = currentValue > rule.threshold; break;
        case 'lt': triggered = currentValue < rule.threshold; break;
        case 'eq': triggered = currentValue === rule.threshold; break;
      }

      if (triggered) {
        newAlerts.push({ rule, value: currentValue, timestamp: new Date() });

        // Show toast for new alerts
        if (!rule.triggered) {
          toast.warning(`Alerta: ${rule.name}`, {
            description: `Valor atual: ${currentValue} (threshold: ${rule.threshold})`
          });
        }
      }

      // Update rule triggered state
      setRules(prev => prev.map(r => 
        r.id === rule.id ? { ...r, triggered, lastTriggered: triggered ? new Date() : r.lastTriggered } : r
      ));
    });

    setAlerts(newAlerts);
  }, [metrics, health]);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const updateThreshold = (id: string, threshold: number) => {
    setRules(prev => prev.map(r => 
      r.id === id ? { ...r, threshold } : r
    ));
  };

  const saveRules = () => {
    localStorage.setItem('observability-alert-rules', JSON.stringify(rules));
    toast.success('Regras salvas');
    setEditingRule(null);
  };

  // Load saved rules on mount
  useEffect(() => {
    const saved = localStorage.getItem('observability-alert-rules');
    if (saved) {
      try {
        setRules(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved rules:', e);
      }
    }
  }, []);

  const triggeredCount = rules.filter(r => r.triggered).length;

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Regras Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {rules.filter(r => r.enabled).length}
            </span>
            <span className="text-sm text-muted-foreground ml-1">
              de {rules.length}
            </span>
          </CardContent>
        </Card>

        <Card className={triggeredCount > 0 ? 'border-destructive' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${triggeredCount > 0 ? 'text-destructive' : ''}`} />
              Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold ${triggeredCount > 0 ? 'text-destructive' : 'text-green-500'}`}>
              {triggeredCount}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={triggeredCount === 0 ? 'default' : 'destructive'}>
              {triggeredCount === 0 ? 'Tudo OK' : `${triggeredCount} Alertas`}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Alertas Ativos
            </CardTitle>
            <CardDescription>Thresholds ultrapassados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded bg-destructive/10 border border-destructive/20">
                  <div>
                    <p className="font-medium">{alert.rule.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Valor: {alert.value} (threshold: {alert.rule.threshold})
                    </p>
                  </div>
                  <Badge variant="destructive">Ativo</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuração de Alertas
              </CardTitle>
              <CardDescription>Configure thresholds para cada métrica</CardDescription>
            </div>
            <Button onClick={saveRules} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rules.map(rule => (
              <div 
                key={rule.id} 
                className={`flex items-center justify-between p-3 rounded border ${
                  rule.triggered ? 'border-destructive bg-destructive/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      {rule.triggered && (
                        <Badge variant="destructive" className="text-xs">Triggered</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rule.metric} {rule.operator === 'gt' ? '>' : rule.operator === 'lt' ? '<' : '='} threshold
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingRule === rule.id ? (
                    <>
                      <Input
                        type="number"
                        value={rule.threshold}
                        onChange={(e) => updateThreshold(rule.id, Number(e.target.value))}
                        className="w-20"
                      />
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setEditingRule(null)}
                      >
                        OK
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">{rule.threshold}</Badge>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setEditingRule(rule.id)}
                      >
                        Editar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
