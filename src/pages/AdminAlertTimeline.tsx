import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Clock, CheckCircle2, AlertTriangle, Shield, Eye, ArrowUpCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSecurityAlertStatsService, type AlertTimelineItem } from "@/services/securityAlertStatsService";
import { cn } from "@/lib/utils";
import { RealtimeChannel } from "@supabase/supabase-js";

export default function AdminAlertTimeline() {
  const navigate = useNavigate();
  const [hours, setHours] = useState<number>(24);
  const [timeline, setTimeline] = useState<AlertTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
    
    // Atualização periódica a cada 30 segundos
    const interval = setInterval(() => {
      loadTimeline();
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [hours]);

  useEffect(() => {
    // Subscribe to real-time updates
    const service = getSecurityAlertStatsService();
    const channel = service.subscribeToTimeline((newItem) => {
      setTimeline((prev) => {
        // Atualizar item existente ou adicionar novo
        const index = prev.findIndex(item => item.delivery_id === newItem.delivery_id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = newItem;
          return updated;
        } else {
          return [newItem, ...prev];
        }
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadTimeline = async () => {
    setLoading(true);
    const service = getSecurityAlertStatsService();
    const data = await service.getAlertTimeline(hours, 100);
    setTimeline(data);
    setLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (item: AlertTimelineItem) => {
    if (item.action_taken) return <CheckCircle2 className="h-5 w-5 text-success" />;
    if (item.escalated) return <ArrowUpCircle className="h-5 w-5 text-destructive" />;
    if (item.confirmed_at) return <CheckCircle2 className="h-5 w-5 text-primary" />;
    if (item.read_at) return <Eye className="h-5 w-5 text-accent" />;
    return <Clock className="h-5 w-5 text-muted-foreground" />;
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      failed_login: 'Login Falhou',
      permission_change: 'Mudança de Permissão',
      suspicious_activity: 'Atividade Suspeita',
      rate_limit_exceeded: 'Limite Excedido',
      unauthorized_access: 'Acesso Não Autorizado'
    };
    return labels[type] || type;
  };

  const getActionLabel = (action: string | null) => {
    if (!action) return null;
    const labels: Record<string, string> = {
      investigating: 'Em Investigação',
      resolved: 'Resolvido',
      escalated: 'Escalonado'
    };
    return labels[action] || action;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return null;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Timeline de Alertas</h1>
          <p className="text-muted-foreground">Acompanhamento em tempo real do fluxo de alertas</p>
        </div>
        <div className="flex gap-2">
          <Select value={hours.toString()} onValueChange={(v) => setHours(parseInt(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Última hora</SelectItem>
              <SelectItem value="6">Últimas 6 horas</SelectItem>
              <SelectItem value="24">Últimas 24 horas</SelectItem>
              <SelectItem value="72">Últimos 3 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadTimeline} variant="outline">
            Atualizar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {timeline.map((item, index) => (
          <Card key={item.delivery_id} className={cn(
            "transition-all",
            index === 0 && "ring-2 ring-primary"
          )}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(item)}
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getEventTypeLabel(item.event_type)}
                      <Badge variant={getSeverityColor(item.severity)}>
                        {item.severity}
                      </Badge>
                      {item.action_taken && (
                        <Badge variant="outline">
                          {getActionLabel(item.action_taken)}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Enviado para: {item.admin_name} • {formatTimestamp(item.sent_at)}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative pl-8">
                {/* Timeline visual */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-border">
                  {/* Pontos na timeline */}
                  <div className="absolute top-2 -left-1 w-2 h-2 rounded-full bg-primary" />
                  {item.read_at && (
                    <div className="absolute top-1/3 -left-1 w-2 h-2 rounded-full bg-accent" />
                  )}
                  {item.confirmed_at && (
                    <div className="absolute top-2/3 -left-1 w-2 h-2 rounded-full bg-success" />
                  )}
                  {item.escalated && (
                    <div className="absolute bottom-2 -left-1 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">📤 Enviado</span>
                    <span>{formatTimestamp(item.sent_at)}</span>
                  </div>

                  {item.read_at && (
                    <div className="flex justify-between text-accent">
                      <span>👁️ Lido</span>
                      <span>
                        {formatTimestamp(item.read_at)}
                        <span className="ml-2 text-xs">
                          ({calculateDuration(item.sent_at, item.read_at)})
                        </span>
                      </span>
                    </div>
                  )}

                  {item.confirmed_at && (
                    <div className="flex justify-between text-success">
                      <span>✅ Confirmado</span>
                      <span>
                        {formatTimestamp(item.confirmed_at)}
                        <span className="ml-2 text-xs">
                          ({calculateDuration(item.sent_at, item.confirmed_at)})
                        </span>
                      </span>
                    </div>
                  )}

                  {item.action_taken_at && (
                    <div className="flex justify-between text-primary">
                      <span>⚡ Ação Tomada: {getActionLabel(item.action_taken)}</span>
                      <span>
                        {formatTimestamp(item.action_taken_at)}
                        <span className="ml-2 text-xs">
                          ({calculateDuration(item.sent_at, item.action_taken_at)})
                        </span>
                      </span>
                    </div>
                  )}

                  {item.escalated_at && (
                    <div className="flex justify-between text-destructive">
                      <span>🚨 Escalonado</span>
                      <span>
                        {formatTimestamp(item.escalated_at)}
                        <span className="ml-2 text-xs">
                          ({calculateDuration(item.sent_at, item.escalated_at)})
                        </span>
                      </span>
                    </div>
                  )}

                  {!item.read_at && !item.confirmed_at && (
                    <div className="text-muted-foreground italic">
                      ⏳ Aguardando leitura...
                    </div>
                  )}
                </div>
              </div>

              {item.event_details && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="text-xs font-medium mb-1">Detalhes do Evento:</div>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(item.event_details, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {timeline.length === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum alerta no período selecionado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
