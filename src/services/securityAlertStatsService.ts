/**
 * Security Alert Stats Service
 * Uses security_alert_deliveries table
 */

import { supabase } from '@/lib/supabase';

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
  async getAlertPerformanceStats(days: number = 30): Promise<AlertPerformanceStats | null> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('security_alert_deliveries')
        .select('sent_at, confirmed_at, escalated, response_time_ms')
        .gte('sent_at', since.toISOString());

      if (error || !data) {
        console.warn('[SecurityAlertStats] Error getting stats:', error);
        return null;
      }

      const total = data.length;
      const confirmed = data.filter(d => d.confirmed_at).length;
      const escalated = data.filter(d => d.escalated).length;
      
      const responseTimes = data
        .filter(d => d.response_time_ms)
        .map(d => d.response_time_ms!);
      
      const avgResponseTime = responseTimes.length 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60000 
        : 0;

      return {
        total_alerts: total,
        confirmed_alerts: confirmed,
        confirmation_rate: total ? (confirmed / total) * 100 : 0,
        avg_read_time_minutes: avgResponseTime,
        avg_confirmation_time_minutes: avgResponseTime,
        total_escalations: escalated,
        escalation_rate: total ? (escalated / total) * 100 : 0,
      };
    } catch (error) {
      console.error('[SecurityAlertStats] Error:', error);
      return null;
    }
  }

  async getAdminPerformanceStats(days: number = 30): Promise<AdminPerformanceStats[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('security_alert_deliveries')
        .select('admin_id, admin_phone, confirmed_at, action_taken, response_time_ms')
        .gte('sent_at', since.toISOString());

      if (error || !data) {
        console.warn('[SecurityAlertStats] Error getting admin stats:', error);
        return [];
      }

      // Group by admin
      const adminStats = new Map<string, any>();
      
      for (const delivery of data) {
        const key = delivery.admin_id || delivery.admin_phone;
        if (!key) continue;

        if (!adminStats.has(key)) {
          adminStats.set(key, {
            admin_id: delivery.admin_id || '',
            admin_phone: delivery.admin_phone || '',
            admin_name: 'Admin',
            total_alerts: 0,
            confirmed_alerts: 0,
            alerts_with_action: 0,
            response_times: [],
          });
        }

        const stats = adminStats.get(key);
        stats.total_alerts++;
        if (delivery.confirmed_at) stats.confirmed_alerts++;
        if (delivery.action_taken) stats.alerts_with_action++;
        if (delivery.response_time_ms) stats.response_times.push(delivery.response_time_ms);
      }

      return Array.from(adminStats.values()).map(stats => ({
        admin_id: stats.admin_id,
        admin_name: stats.admin_name,
        admin_phone: stats.admin_phone,
        total_alerts: stats.total_alerts,
        confirmed_alerts: stats.confirmed_alerts,
        confirmation_rate: stats.total_alerts 
          ? (stats.confirmed_alerts / stats.total_alerts) * 100 
          : 0,
        avg_response_time_minutes: stats.response_times.length
          ? stats.response_times.reduce((a: number, b: number) => a + b, 0) / stats.response_times.length / 60000
          : 0,
        alerts_with_action: stats.alerts_with_action,
      }));
    } catch (error) {
      console.error('[SecurityAlertStats] Error:', error);
      return [];
    }
  }

  async getAlertTimeline(hours: number = 24, limit: number = 100): Promise<AlertTimelineItem[]> {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await supabase
        .from('security_alert_deliveries')
        .select('*')
        .gte('sent_at', since.toISOString())
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        console.warn('[SecurityAlertStats] Error getting timeline:', error);
        return [];
      }

      return data.map(d => ({
        delivery_id: d.id,
        event_id: d.alert_id || '',
        event_type: '',
        severity: '',
        admin_name: 'Admin',
        admin_phone: d.admin_phone || '',
        sent_at: d.sent_at || '',
        read_at: null,
        confirmed_at: d.confirmed_at,
        escalated: d.escalated || false,
        escalated_at: null,
        action_taken: d.action_taken,
        action_taken_at: null,
        delivery_status: d.confirmed_at ? 'confirmed' : 'sent',
        event_details: null,
      }));
    } catch (error) {
      console.error('[SecurityAlertStats] Error:', error);
      return [];
    }
  }

  subscribeToTimeline(callback: (item: AlertTimelineItem) => void) {
    const channel = supabase
      .channel('security_alert_deliveries')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alert_deliveries',
        },
        (payload) => {
          const d = payload.new as any;
          callback({
            delivery_id: d.id,
            event_id: d.alert_id || '',
            event_type: '',
            severity: '',
            admin_name: 'Admin',
            admin_phone: d.admin_phone || '',
            sent_at: d.sent_at || '',
            read_at: null,
            confirmed_at: d.confirmed_at,
            escalated: d.escalated || false,
            escalated_at: null,
            action_taken: d.action_taken,
            action_taken_at: null,
            delivery_status: 'sent',
            event_details: null,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  async getAlertMetricsByPeriod(days: number = 7): Promise<Array<{
    date: string;
    total: number;
    confirmed: number;
    escalated: number;
    with_action: number;
  }>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('security_alert_deliveries')
        .select('sent_at, confirmed_at, escalated, action_taken')
        .gte('sent_at', since.toISOString());

      if (error || !data) {
        return [];
      }

      // Group by date
      const byDate = new Map<string, any>();
      
      for (const d of data) {
        const date = d.sent_at?.split('T')[0] || '';
        if (!date) continue;

        if (!byDate.has(date)) {
          byDate.set(date, { total: 0, confirmed: 0, escalated: 0, with_action: 0 });
        }

        const stats = byDate.get(date);
        stats.total++;
        if (d.confirmed_at) stats.confirmed++;
        if (d.escalated) stats.escalated++;
        if (d.action_taken) stats.with_action++;
      }

      return Array.from(byDate.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('[SecurityAlertStats] Error:', error);
      return [];
    }
  }
}

let instance: SecurityAlertStatsService | null = null;

export function getSecurityAlertStatsService(): SecurityAlertStatsService {
  if (!instance) {
    instance = new SecurityAlertStatsService();
  }
  return instance;
}

export { SecurityAlertStatsService };
