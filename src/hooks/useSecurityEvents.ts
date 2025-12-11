import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { securityMonitoringService, SecurityEvent } from '@/services/securityMonitoringService';
import { useToast } from '@/hooks/use-toast';

export const useSecurityEvents = (autoRefresh: boolean = true) => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    criticalEvents: 0,
    failedLogins: 0,
    permissionChanges: 0,
    suspiciousActivities: 0,
    unresolvedEvents: 0
  });
  const { toast } = useToast();

  const fetchEvents = async () => {
    setLoading(true);
    const data = await securityMonitoringService.fetchEvents({ limit: 100 });
    setEvents(data);
    setLoading(false);
  };

  const fetchStats = async () => {
    const statistics = await securityMonitoringService.getStatistics('day');
    setStats(statistics);
  };

  const resolveEvent = async (eventId: string) => {
    const success = await securityMonitoringService.resolveEvent(eventId);
    
    if (success) {
      toast({
        title: "Evento resolvido",
        description: "O evento de segurança foi marcado como resolvido.",
      });
      await fetchEvents();
      await fetchStats();
    } else {
      toast({
        title: "Erro",
        description: "Falha ao resolver o evento.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchStats();

    if (autoRefresh) {
      const channel = supabase
        .channel('security-events-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'security_events'
          },
          async (payload) => {
            const newEvent = payload.new as SecurityEvent;
            
            // Show toast for critical events
            if (newEvent.severity === 'critical') {
              toast({
                title: "⚠️ Alerta de Segurança Crítico",
                description: getEventDescription(newEvent),
                variant: "destructive",
              });
            } else if (newEvent.severity === 'warning') {
              toast({
                title: "⚠️ Alerta de Segurança",
                description: getEventDescription(newEvent),
              });
            }

            // Add to events list
            setEvents(prev => [newEvent, ...prev]);
            fetchStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'security_events'
          },
          () => {
            fetchEvents();
            fetchStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [autoRefresh]);

  return {
    events,
    loading,
    stats,
    refetch: fetchEvents,
    resolveEvent
  };
};

function getEventDescription(event: SecurityEvent): string {
  switch (event.event_type) {
    case 'failed_login':
      return `Tentativa de login falhou para ${event.event_details?.email || 'usuário desconhecido'}`;
    case 'permission_change':
      return `Permissões alteradas: ${event.event_details?.old_role || 'N/A'} → ${event.event_details?.new_role}`;
    case 'suspicious_activity':
      return event.event_details?.description || 'Atividade suspeita detectada';
    case 'rate_limit_exceeded':
      return `Limite de taxa excedido no endpoint ${event.event_details?.endpoint}`;
    case 'unauthorized_access':
      return `Tentativa de acesso não autorizado ao recurso ${event.event_details?.resource}`;
    default:
      return 'Evento de segurança detectado';
  }
}
