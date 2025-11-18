import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useStatusHistory } from '@/hooks/useStatusHistory';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StatusChangeTimelineProps {
  serviceName?: string;
  limit?: number;
  showServiceName?: boolean;
}

export function StatusChangeTimeline({ 
  serviceName, 
  limit = 50,
  showServiceName = true 
}: StatusChangeTimelineProps) {
  const { history, loading } = useStatusHistory(serviceName, limit);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Mudanças</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Mudanças</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">Nenhuma mudança registrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              As mudanças de status aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Mudanças de Status
        </CardTitle>
        <CardDescription>
          {serviceName 
            ? `Timeline de mudanças para ${serviceName}`
            : 'Timeline de todas as mudanças de status'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="relative space-y-4">
            {/* Linha vertical da timeline */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
            
            {history.map((change, index) => {
              const isUpgrade = change.previous_status && 
                ['error', 'critical', 'down', 'degraded'].includes(change.previous_status.toLowerCase()) &&
                ['operational', 'healthy', 'active', 'success'].includes(change.new_status.toLowerCase());
              
              const isDowngrade = change.previous_status && 
                ['operational', 'healthy', 'active', 'success'].includes(change.previous_status.toLowerCase()) &&
                ['error', 'critical', 'down', 'degraded'].includes(change.new_status.toLowerCase());

              return (
                <div key={change.id} className="relative pl-12">
                  {/* Ponto na timeline */}
                  <div className={`absolute left-2 top-2 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center
                    ${isUpgrade ? 'bg-green-500' : isDowngrade ? 'bg-red-500' : 'bg-blue-500'}`}
                  >
                    {isUpgrade ? (
                      <TrendingUp className="h-3 w-3 text-white" />
                    ) : isDowngrade ? (
                      <TrendingDown className="h-3 w-3 text-white" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>

                  <Card className="animate-fade-in">
                    <CardContent className="pt-4 pb-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            {showServiceName && (
                              <p className="font-semibold text-sm">{change.service_name}</p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {change.previous_status ? (
                                <>
                                  <StatusBadge 
                                    status={change.previous_status} 
                                    showTooltip={false}
                                  />
                                  <span className="text-muted-foreground">→</span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Inicial:</span>
                              )}
                              <StatusBadge 
                                status={change.new_status}
                                showTooltip={false}
                              />
                            </div>
                            {change.metadata && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {JSON.stringify(change.metadata)}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            <p>{format(new Date(change.changed_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                            <p>{format(new Date(change.changed_at), 'HH:mm:ss', { locale: ptBR })}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
