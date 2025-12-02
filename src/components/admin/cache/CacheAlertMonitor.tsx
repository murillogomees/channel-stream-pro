import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react';

interface Alert {
  type: string;
  severity: string;
  message: string;
  value: number;
  threshold: number;
}

export function CacheAlertMonitor() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const checkAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('cache-alerts');

      if (error) throw error;

      setAlerts(data.alerts || []);
      setLastCheck(data.checked_at);
    } catch (error) {
      console.error('Failed to check alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const getSeverityIcon = (severity: string) => {
    if (severity === 'error') return <AlertTriangle className="w-4 h-4 text-destructive" />;
    if (severity === 'warning') return <TrendingDown className="w-4 h-4 text-amber-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'error') return 'destructive';
    if (severity === 'warning') return 'default';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alertas Automáticos
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real de métricas críticas
            </CardDescription>
          </div>
          <Button onClick={checkAlerts} disabled={loading} variant="outline" size="sm">
            Verificar Agora
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastCheck && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            Última verificação: {new Date(lastCheck).toLocaleString('pt-BR')}
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <p className="text-sm font-medium">Nenhum alerta ativo</p>
            <p className="text-xs text-muted-foreground">Todas as métricas dentro dos limites</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity === 'error' ? 'Crítico' : 'Aviso'}
                      </Badge>
                      <span className="text-sm font-medium capitalize">
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Valor atual: {alert.value.toFixed(1)} | Limite: {alert.threshold}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
