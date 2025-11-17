import { supabase } from "@/integrations/supabase/client";

export interface AlertPerformanceStats {
  total_alerts: number;
  confirmed_alerts: number;
  confirmation_rate: number;
  avg_read_time_minutes: number;
  avg_confirmation_time_minutes: number;
  total_escalations: number;
  escalation_rate: number;
}

export interface AdminPerformanceStats {
  admin_id: string;
  admin_name: string;
  admin_phone: string;
  total_alerts: number;
  confirmed_alerts: number;
  confirmation_rate: number;
  avg_response_time_minutes: number;
  alerts_with_action: number;
}

export interface AlertTimelineItem {
  delivery_id: string;
  event_id: string;
  event_type: string;
  severity: string;
  admin_name: string;
  admin_phone: string;
  sent_at: string;
  read_at: string | null;
  confirmed_at: string | null;
  escalated: boolean;
  escalated_at: string | null;
  action_taken: string | null;
  action_taken_at: string | null;
  delivery_status: string;
  event_details: any;
}

class SecurityAlertStatsService {
  /**
   * Busca estatísticas gerais de performance dos alertas
   */
  async getAlertPerformanceStats(days: number = 30): Promise<AlertPerformanceStats | null> {
    try {
      const { data, error } = await supabase.rpc('get_alert_performance_stats', {
        _days: days
      });

      if (error) {
        console.error('[AlertStats] Erro ao buscar estatísticas:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('[AlertStats] Erro ao buscar estatísticas:', error);
      return null;
    }
  }

  /**
   * Busca estatísticas de performance por admin
   */
  async getAdminPerformanceStats(days: number = 30): Promise<AdminPerformanceStats[]> {
    try {
      const { data, error } = await supabase.rpc('get_admin_performance_stats', {
        _days: days
      });

      if (error) {
        console.error('[AlertStats] Erro ao buscar estatísticas de admins:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AlertStats] Erro ao buscar estatísticas de admins:', error);
      return [];
    }
  }

  /**
   * Busca timeline de alertas recentes
   */
  async getAlertTimeline(hours: number = 24, limit: number = 100): Promise<AlertTimelineItem[]> {
    try {
      const { data, error } = await supabase.rpc('get_alert_timeline', {
        _hours: hours,
        _limit: limit
      });

      if (error) {
        console.error('[AlertStats] Erro ao buscar timeline:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AlertStats] Erro ao buscar timeline:', error);
      return [];
    }
  }

  /**
   * Subscribe para atualizações em tempo real da timeline
   */
  subscribeToTimeline(callback: (item: AlertTimelineItem) => void) {
    const channel = supabase
      .channel('alert-timeline-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_alert_deliveries'
        },
        async (payload) => {
          console.log('[AlertStats] Timeline update:', payload);
          
          // Buscar dados completos do alerta atualizado
          if (payload.new && 'id' in payload.new) {
            const { data } = await supabase.rpc('get_alert_timeline', {
              _hours: 24,
              _limit: 1
            }).eq('delivery_id', payload.new.id);

            if (data && data[0]) {
              callback(data[0]);
            }
          }
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Calcula métricas agregadas por período
   */
  async getAlertMetricsByPeriod(days: number = 7): Promise<{
    date: string;
    total: number;
    confirmed: number;
    escalated: number;
    with_action: number;
  }[]> {
    try {
      const { data, error } = await supabase
        .from('security_alert_deliveries')
        .select('sent_at, confirmed_at, escalated, action_taken')
        .gte('sent_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('sent_at', { ascending: true });

      if (error) {
        console.error('[AlertStats] Erro ao buscar métricas por período:', error);
        return [];
      }

      // Agrupar por data
      const grouped = (data || []).reduce((acc, item) => {
        const date = new Date(item.sent_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { total: 0, confirmed: 0, escalated: 0, with_action: 0 };
        }
        acc[date].total++;
        if (item.confirmed_at) acc[date].confirmed++;
        if (item.escalated) acc[date].escalated++;
        if (item.action_taken) acc[date].with_action++;
        return acc;
      }, {} as Record<string, any>);

      return Object.entries(grouped).map(([date, metrics]) => ({
        date,
        ...metrics
      }));
    } catch (error) {
      console.error('[AlertStats] Erro ao buscar métricas por período:', error);
      return [];
    }
  }
}

// Singleton
let instance: SecurityAlertStatsService | null = null;

export function getSecurityAlertStatsService(): SecurityAlertStatsService {
  if (!instance) {
    instance = new SecurityAlertStatsService();
  }
  return instance;
}

export { SecurityAlertStatsService };
