import { supabase } from "@/integrations/supabase/client";

export interface DailySecurityMetrics {
  date: string;
  total_events: number;
  failed_logins: number;
  suspicious_activities: number;
  rate_limit_exceeded: number;
  unauthorized_access: number;
  permission_changes: number;
  critical_count: number;
  warning_count: number;
}

export const securityAnalyticsService = {
  /**
   * Get daily security metrics for charts
   */
  async getDailyMetrics(days: number = 7): Promise<DailySecurityMetrics[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_security_analytics', { _days: days });

      if (error) {
        console.error('[SecurityAnalytics] Failed to get daily metrics:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.date,
        total_events: Number(row.total_events),
        failed_logins: Number(row.failed_logins),
        suspicious_activities: Number(row.suspicious_activities),
        rate_limit_exceeded: Number(row.rate_limit_exceeded),
        unauthorized_access: Number(row.unauthorized_access),
        permission_changes: Number(row.permission_changes),
        critical_count: Number(row.critical_count),
        warning_count: Number(row.warning_count)
      }));
    } catch (error) {
      console.error('[SecurityAnalytics] Error getting daily metrics:', error);
      return [];
    }
  },

  /**
   * Get event type distribution
   */
  async getEventTypeDistribution(days: number = 7): Promise<{ name: string; value: number; }[]> {
    try {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - days);

      const { data, error } = await supabase
        .from('security_events')
        .select('event_type')
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('[SecurityAnalytics] Failed to get distribution:', error);
        return [];
      }

      const counts: Record<string, number> = {};
      data.forEach(event => {
        counts[event.event_type] = (counts[event.event_type] || 0) + 1;
      });

      return Object.entries(counts).map(([name, value]) => ({
        name: this.getEventTypeLabel(name),
        value
      }));
    } catch (error) {
      console.error('[SecurityAnalytics] Error getting distribution:', error);
      return [];
    }
  },

  /**
   * Get severity distribution
   */
  async getSeverityDistribution(days: number = 7): Promise<{ name: string; value: number; }[]> {
    try {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - days);

      const { data, error } = await supabase
        .from('security_events')
        .select('severity')
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('[SecurityAnalytics] Failed to get severity distribution:', error);
        return [];
      }

      const counts: Record<string, number> = {};
      data.forEach(event => {
        counts[event.severity] = (counts[event.severity] || 0) + 1;
      });

      return Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));
    } catch (error) {
      console.error('[SecurityAnalytics] Error getting severity distribution:', error);
      return [];
    }
  },

  /**
   * Get hourly pattern (which hours see most events)
   */
  async getHourlyPattern(days: number = 7): Promise<{ hour: number; count: number; }[]> {
    try {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - days);

      const { data, error } = await supabase
        .from('security_events')
        .select('created_at')
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('[SecurityAnalytics] Failed to get hourly pattern:', error);
        return [];
      }

      const hourCounts = Array(24).fill(0);
      data.forEach(event => {
        const hour = new Date(event.created_at).getHours();
        hourCounts[hour]++;
      });

      return hourCounts.map((count, hour) => ({ hour, count }));
    } catch (error) {
      console.error('[SecurityAnalytics] Error getting hourly pattern:', error);
      return [];
    }
  },

  /**
   * Get resolution rate
   */
  async getResolutionRate(days: number = 7): Promise<{ resolved: number; unresolved: number; }> {
    try {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - days);

      const { data, error } = await supabase
        .from('security_events')
        .select('resolved')
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('[SecurityAnalytics] Failed to get resolution rate:', error);
        return { resolved: 0, unresolved: 0 };
      }

      const resolved = data.filter(e => e.resolved).length;
      const unresolved = data.filter(e => !e.resolved).length;

      return { resolved, unresolved };
    } catch (error) {
      console.error('[SecurityAnalytics] Error getting resolution rate:', error);
      return { resolved: 0, unresolved: 0 };
    }
  },

  getEventTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'failed_login': 'Login Falhou',
      'permission_change': 'Mudança de Permissão',
      'suspicious_activity': 'Atividade Suspeita',
      'rate_limit_exceeded': 'Limite Excedido',
      'unauthorized_access': 'Acesso Não Autorizado'
    };
    return labels[type] || type;
  }
};
