import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAffiliateFraud, FraudLog } from '@/hooks/useAffiliateFraud';
import { AlertTriangle, Shield, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function AffiliateFraudDetection() {
  const { fraudLogs, unresolvedCount, loading, resolveFraudLog, getSeverityStats, getEventTypeStats } = useAffiliateFraud();
  const [selectedLog, setSelectedLog] = useState<FraudLog | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);

  const severityStats = getSeverityStats();
  const eventTypeStats = getEventTypeStats();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'self_referral': return 'Auto-indicação';
      case 'duplicate_ip': return 'IP Duplicado';
      case 'suspicious_pattern': return 'Padrão Suspeito';
      case 'rapid_clicks': return 'Cliques Rápidos';
      default: return type;
    }
  };

  const handleResolve = async () => {
    if (selectedLog && resolutionNotes.trim()) {
      await resolveFraudLog(selectedLog.id, resolutionNotes);
      setSelectedLog(null);
      setResolutionNotes('');
    }
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  const filteredLogs = showOnlyUnresolved 
    ? fraudLogs.filter(l => !l.resolved)
    : fraudLogs;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Não Resolvidos</p>
                <p className="text-2xl font-bold">{unresolvedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Críticos</p>
                <p className="text-2xl font-bold text-red-500">{severityStats.critical}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Alta Severidade</p>
                <p className="text-2xl font-bold text-orange-500">{severityStats.high}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Média</p>
                <p className="text-2xl font-bold text-yellow-500">{severityStats.medium}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Baixa</p>
                <p className="text-2xl font-bold text-blue-500">{severityStats.low}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribuição por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventTypeStats).map(([type, count]) => (
              <Badge key={type} variant="outline" className="py-1 px-3">
                {getEventTypeLabel(type)}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Logs de Fraude</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowOnlyUnresolved(!showOnlyUnresolved)}
          >
            {showOnlyUnresolved ? 'Mostrar Todos' : 'Apenas Pendentes'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Afiliado</th>
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-left py-2 px-3">Severidade</th>
                  <th className="text-left py-2 px-3">IP</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-3">{log.affiliate_name}</td>
                    <td className="py-2 px-3">{getEventTypeLabel(log.event_type)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{log.ip_address || '-'}</td>
                    <td className="py-2 px-3">
                      {log.resolved ? (
                        <span className="flex items-center gap-1 text-green-500">
                          <CheckCircle className="h-3 w-3" />
                          Resolvido
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-500">
                          <Clock className="h-3 w-3" />
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {!log.resolved && (
                        <Button size="sm" variant="ghost" onClick={() => setSelectedLog(log)}>
                          Resolver
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum log de fraude encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Alerta de Fraude</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLog && (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm"><strong>Tipo:</strong> {getEventTypeLabel(selectedLog.event_type)}</p>
                  <p className="text-sm"><strong>Afiliado:</strong> {selectedLog.affiliate_name}</p>
                  <p className="text-sm"><strong>IP:</strong> {selectedLog.ip_address}</p>
                  {selectedLog.details && (
                    <pre className="text-xs mt-2 p-2 bg-background rounded">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas de Resolução</label>
                  <Input
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Descreva a ação tomada..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedLog(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleResolve} disabled={!resolutionNotes.trim()}>
                    Marcar como Resolvido
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
