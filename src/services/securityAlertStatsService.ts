// Simplified Security Alert Stats Service - Placeholder implementation

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
    console.log('[SecurityAlertStatsService] getAlertPerformanceStats - placeholder');
    return {
      total_alerts: 0,
      confirmed_alerts: 0,
      confirmation_rate: 0,
      avg_read_time_minutes: 0,
      avg_confirmation_time_minutes: 0,
      total_escalations: 0,
      escalation_rate: 0,
    };
  }

  async getAdminPerformanceStats(days: number = 30): Promise<AdminPerformanceStats[]> {
    console.log('[SecurityAlertStatsService] getAdminPerformanceStats - placeholder');
    return [];
  }

  async getAlertTimeline(hours: number = 24, limit: number = 100): Promise<AlertTimelineItem[]> {
    console.log('[SecurityAlertStatsService] getAlertTimeline - placeholder');
    return [];
  }

  subscribeToTimeline(callback: (item: AlertTimelineItem) => void) {
    console.log('[SecurityAlertStatsService] subscribeToTimeline - placeholder');
    return {
      unsubscribe: () => {},
    };
  }

  async getAlertMetricsByPeriod(days: number = 7): Promise<Array<{
    date: string;
    total: number;
    confirmed: number;
    escalated: number;
    with_action: number;
  }>> {
    console.log('[SecurityAlertStatsService] getAlertMetricsByPeriod - placeholder');
    return [];
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
