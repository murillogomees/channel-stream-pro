import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, Users, CheckCircle2, XCircle, Clock, Activity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRealtimeService, RealtimeNotificationEvent, RealtimeStats } from "@/services/realtimeNotificationService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const AdminNotificationLive = () => {
  const navigate = useNavigate();
  const realtimeService = getRealtimeService();
  
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [events, setEvents] = useState<RealtimeNotificationEvent[]>([]);
  const [stats, setStats] = useState<RealtimeStats>({
    totalSent: 0,
    successCount: 0,
    errorCount: 0,
    lastUpdate: new Date().toISOString(),
  });
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const listenerIdRef = useRef(`live-dashboard-${Date.now()}`);

  useEffect(() => {
    // Conectar ao canal Realtime
    realtimeService.connect();
    setConnectionStatus(realtimeService.getConnectionStatus());

    // Registrar listener para eventos
    const listenerId = listenerIdRef.current;
    realtimeService.subscribe(listenerId, handleRealtimeEvent);

    // Atualizar status da conexão periodicamente
    const statusInterval = setInterval(() => {
      setConnectionStatus(realtimeService.getConnectionStatus());
    }, 2000);

    return () => {
      clearInterval(statusInterval);
      realtimeService.unsubscribe(listenerId);
    };
  }, []);

  // Auto-scroll para o final quando novos eventos chegam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const handleRealtimeEvent = (event: RealtimeNotificationEvent) => {
    console.log('[Dashboard] Evento recebido:', event);
    
    setEvents((prev) => {
      const newEvents = [event, ...prev];
      // Manter apenas os últimos 100 eventos
      return newEvents.slice(0, 100);
    });

    // Atualizar estatísticas
    setStats((prev) => {
      const newStats = { ...prev, lastUpdate: event.timestamp };
      
      if (event.type === 'notification_sent') {
        newStats.totalSent++;
        newStats.successCount++;
      } else if (event.type === 'notification_failed') {
        newStats.totalSent++;
        newStats.errorCount++;
      } else if (event.type === 'batch_started') {
        setIsBatchRunning(true);
      } else if (event.type === 'batch_completed') {
        setIsBatchRunning(false);
        if (event.data.successCount) newStats.successCount += event.data.successCount;
        if (event.data.errorCount) newStats.errorCount += event.data.errorCount;
      }
      
      return newStats;
    });
  };

  const clearEvents = () => {
    setEvents([]);
    setStats({
      totalSent: 0,
      successCount: 0,
      errorCount: 0,
      lastUpdate: new Date().toISOString(),
    });
  };

  const getEventIcon = (type: RealtimeNotificationEvent['type']) => {
    switch (type) {
      case 'notification_sent':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'notification_failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'batch_started':
        return <Zap className="h-5 w-5 text-blue-600" />;
      case 'batch_completed':
        return <CheckCircle2 className="h-5 w-5 text-purple-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getEventTitle = (event: RealtimeNotificationEvent) => {
    switch (event.type) {
      case 'notification_sent':
        return `Enviado para ${event.data.clienteNome}`;
      case 'notification_failed':
        return `Falha ao enviar para ${event.data.clienteNome}`;
      case 'batch_started':
        return `Lote iniciado (${event.data.batchSize} notificações)`;
      case 'batch_completed':
        return `Lote concluído (${event.data.successCount} sucesso, ${event.data.errorCount} erros)`;
      default:
        return 'Evento desconhecido';
    }
  };

  const successRate = stats.totalSent > 0 
    ? ((stats.successCount / stats.totalSent) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Dashboard em Tempo Real</h1>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-3 w-3 rounded-full animate-pulse",
                  connectionStatus === 'connected' && "bg-green-500",
                  connectionStatus === 'connecting' && "bg-yellow-500",
                  connectionStatus === 'disconnected' && "bg-red-500"
                )} />
                <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
                  {connectionStatus === 'connected' && 'Conectado'}
                  {connectionStatus === 'connecting' && 'Conectando...'}
                  {connectionStatus === 'disconnected' && 'Desconectado'}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground">
              Monitoramento ao vivo de notificações WhatsApp
            </p>
          </div>
          {events.length > 0 && (
            <Button variant="outline" onClick={clearEvents}>
              Limpar Eventos
            </Button>
          )}
        </div>

        {/* Cards de Estatísticas em Tempo Real */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={cn(
            "transition-all duration-300",
            isBatchRunning && "ring-2 ring-primary"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Enviado</p>
                  <p className="text-3xl font-bold">{stats.totalSent}</p>
                </div>
                <Radio className={cn(
                  "h-8 w-8",
                  isBatchRunning ? "text-primary animate-pulse" : "text-muted-foreground"
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-3xl font-bold text-green-600">{stats.successCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Erros</p>
                  <p className="text-3xl font-bold text-red-600">{stats.errorCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-3xl font-bold">{successRate}%</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stream de Eventos em Tempo Real */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-600 animate-pulse" />
                  Stream de Eventos ao Vivo
                </CardTitle>
                <CardDescription>
                  Acompanhe as notificações sendo enviadas em tempo real
                </CardDescription>
              </div>
              {stats.lastUpdate && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Última atualização</p>
                  <p className="text-sm font-medium">
                    {format(new Date(stats.lastUpdate), "HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Aguardando eventos...</p>
                <p className="text-sm text-muted-foreground">
                  Os eventos aparecerão aqui quando notificações forem enviadas
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4" ref={scrollRef}>
                <div className="space-y-3">
                  {events.map((event, index) => (
                    <div
                      key={`${event.timestamp}-${index}`}
                      className={cn(
                        "p-4 border rounded-lg transition-all duration-300 animate-in slide-in-from-top-2",
                        event.type === 'notification_sent' && "border-green-200 bg-green-50/50",
                        event.type === 'notification_failed' && "border-red-200 bg-red-50/50",
                        event.type === 'batch_started' && "border-blue-200 bg-blue-50/50",
                        event.type === 'batch_completed' && "border-purple-200 bg-purple-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium">{getEventTitle(event)}</p>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(event.timestamp), "HH:mm:ss", { locale: ptBR })}
                            </Badge>
                          </div>
                          
                          {event.data.telefone && (
                            <p className="text-sm text-muted-foreground font-mono">
                              {event.data.telefone}
                            </p>
                          )}
                          
                          {event.data.template && (
                            <p className="text-sm text-muted-foreground">
                              Template: {event.data.template}
                            </p>
                          )}
                          
                          {event.data.error && (
                            <p className="text-sm text-red-600 mt-1">
                              Erro: {event.data.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Informação sobre o Sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• O dashboard se conecta em tempo real ao sistema de notificações</p>
            <p>• Todos os envios são exibidos instantaneamente conforme acontecem</p>
            <p>• As estatísticas são atualizadas automaticamente a cada evento</p>
            <p>• A conexão é mantida via WebSocket do Supabase Realtime</p>
            <p>• Os eventos são armazenados apenas durante a sessão ativa</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminNotificationLive;
