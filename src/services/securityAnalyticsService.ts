// Simplified Security Analytics Service - Placeholder implementation
import { supabase } from "@/lib/supabase";

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
  async getDailyMetrics(days: number = 7): Promise<DailySecurityMetrics[]> {
    console.log('[SecurityAnalytics] getDailyMetrics - placeholder');
    return [];
  },

  async getEventTypeDistribution(days: number = 7): Promise<{ name: string; value: number }[]> {
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
      (data || []).forEach(event => {
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

  async getSeverityDistribution(days: number = 7): Promise<{ name: string; value: number }[]> {
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
      (data || []).forEach(event => {
        if (event.severity) {
          counts[event.severity] = (counts[event.severity] || 0) + 1;
        }
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

  async getHourlyPattern(days: number = 7): Promise<{ hour: number; count: number }[]> {
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
      (data || []).forEach(event => {
        if (event.created_at) {
          const hour = new Date(event.created_at).getHours();
          hourCounts[hour]++;
        }
      });

      return hourCounts.map((count, hour) => ({ hour, count }));
    } catch (error) {
      console.error('[SecurityAnalytics] Error getting hourly pattern:', error);
      return [];
    }
  },

  async getResolutionRate(days: number = 7): Promise<{ resolved: number; unresolved: number }> {
    // Column 'resolved' doesn't exist on security_events table
    console.log('[SecurityAnalytics] getResolutionRate - placeholder (resolved column not available)');
    return { resolved: 0, unresolved: 0 };
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
