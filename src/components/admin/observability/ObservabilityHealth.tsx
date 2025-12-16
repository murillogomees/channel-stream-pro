/**
 * ObservabilityHealth - System health status dashboard
 */

import { useObservability } from "@/hooks/useObservability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, Database, Server, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ObservabilityHealth() {
  const { health, isLoading, error, refresh, getStatusColor, getStatusBg } = useObservability({
    autoRefresh: true,
    refreshInterval: 30000
  });

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy': return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getServiceIcon = (serviceName: string) => {
    if (serviceName.includes('database') || serviceName.includes('postgres')) {
      return <Database className="h-4 w-4" />;
    }
    if (serviceName.includes('origin') || serviceName.includes('cdn')) {
      return <Server className="h-4 w-4" />;
    }
    if (serviceName.includes('api') || serviceName.includes('edge')) {
      return <Wifi className="h-4 w-4" />;
    }
    return <Server className="h-4 w-4" />;
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Erro ao carregar status</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card className={health ? getStatusBg(health.status) : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Skeleton className="h-8 w-8 rounded-full" />
              ) : health ? (
                getStatusIcon(health.status)
              ) : null}
              <div>
                <CardTitle>Status Geral do Sistema</CardTitle>
                <CardDescription>
                  {health?.timestamp 
                    ? `Última verificação: ${formatDistanceToNow(new Date(health.timestamp), { addSuffix: true, locale: ptBR })}`
                    : 'Verificando...'}
                </CardDescription>
              </div>
            </div>
            <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : health ? (
              <>
                <Badge 
                  variant={health.status === 'healthy' ? 'default' : health.status === 'degraded' ? 'secondary' : 'destructive'}
                  className="text-lg px-4 py-1"
                >
                  {health.status === 'healthy' ? 'Saudável' : health.status === 'degraded' ? 'Degradado' : 'Indisponível'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Verificação em {health.duration_ms}ms
                </span>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : health?.services?.map((service) => (
          <Card key={service.service} className={getStatusBg(service.status)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getServiceIcon(service.service)}
                  <CardTitle className="text-sm font-medium capitalize">
                    {service.service.replace(/_/g, ' ')}
                  </CardTitle>
                </div>
                {getStatusIcon(service.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={service.status === 'healthy' ? 'default' : service.status === 'degraded' ? 'secondary' : 'destructive'}>
                    {service.status === 'healthy' ? 'OK' : service.status === 'degraded' ? 'Degradado' : 'Falha'}
                  </Badge>
                </div>
                {service.latency !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Latência</span>
                    <span className="font-mono">{service.latency}ms</span>
                  </div>
                )}
                {service.details && Object.keys(service.details).length > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {Object.entries(service.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Auto-healing Actions */}
      {health?.auto_heal_actions && health.auto_heal_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ações de Auto-Recuperação
            </CardTitle>
            <CardDescription>
              Ações automáticas executadas pelo sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.auto_heal_actions.map((action, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    {action.executed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span>{action.type}: {action.target}</span>
                  </div>
                  {action.result && (
                    <Badge variant="outline" className="text-xs">{action.result}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
