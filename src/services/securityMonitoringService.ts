import { supabase } from "@/integrations/supabase/client";

export interface SecurityEvent {
  id: string;
  event_type: 'failed_login' | 'permission_change' | 'suspicious_activity' | 'rate_limit_exceeded' | 'unauthorized_access';
  severity: 'info' | 'warning' | 'critical';
  user_id?: string;
  target_user_id?: string;
  ip_address?: string;
  user_agent?: string;
  event_details?: any;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export const securityMonitoringService = {
  /**
   * Log a security event
   */
  async logEvent(event: Omit<SecurityEvent, 'id' | 'created_at' | 'resolved' | 'resolved_by' | 'resolved_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert(event);

      if (error) {
        console.error('[Security] Failed to log event:', error);
      }
    } catch (error) {
      console.error('[Security] Error logging event:', error);
    }
  },

  /**
   * Log a failed login attempt
   */
  async logFailedLogin(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      event_type: 'failed_login',
      severity: 'warning',
      ip_address: ipAddress,
      user_agent: userAgent,
      event_details: { email, timestamp: new Date().toISOString() }
    });
  },

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    description: string,
    userId?: string,
    severity: 'warning' | 'critical' = 'warning',
    details?: any
  ): Promise<void> {
    await this.logEvent({
      event_type: 'suspicious_activity',
      severity,
      user_id: userId,
      event_details: { description, ...details, timestamp: new Date().toISOString() }
    });
  },

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    endpoint: string,
    identifier: string,
    ipAddress?: string
  ): Promise<void> {
    await this.logEvent({
      event_type: 'rate_limit_exceeded',
      severity: 'warning',
      ip_address: ipAddress,
      event_details: { endpoint, identifier, timestamp: new Date().toISOString() }
    });
  },

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(
    resource: string,
    userId?: string,
    ipAddress?: string,
    details?: any
  ): Promise<void> {
    await this.logEvent({
      event_type: 'unauthorized_access',
      severity: 'warning',
      user_id: userId,
      ip_address: ipAddress,
      event_details: { resource, ...details, timestamp: new Date().toISOString() }
    });
  },

  /**
   * Fetch security events with filters
   */
  async fetchEvents(filters?: {
    eventType?: string;
    severity?: string;
    resolved?: boolean;
    limit?: number;
  }): Promise<SecurityEvent[]> {
    try {
      let query = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters?.resolved !== undefined) {
        query = query.eq('resolved', filters.resolved);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Security] Failed to fetch events:', error);
        return [];
      }

      return (data || []) as SecurityEvent[];
    } catch (error) {
      console.error('[Security] Error fetching events:', error);
      return [];
    }
  },

  /**
   * Mark event as resolved
   */
  async resolveEvent(eventId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('[Security] No authenticated user');
        return false;
      }

      const { error } = await supabase
        .from('security_events')
        .update({
          resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (error) {
        console.error('[Security] Failed to resolve event:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Security] Error resolving event:', error);
      return false;
    }
  },

  /**
   * Get security statistics
   */
  async getStatistics(timeRange: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalEvents: number;
    criticalEvents: number;
    failedLogins: number;
    permissionChanges: number;
    suspiciousActivities: number;
    unresolvedEvents: number;
  }> {
    try {
      const intervals = {
        day: '1 day',
        week: '7 days',
        month: '30 days'
      };

      const { data, error } = await supabase
        .from('security_events')
        .select('event_type, severity, resolved')
        .gte('created_at', `now() - interval '${intervals[timeRange]}'`);

      if (error) {
        console.error('[Security] Failed to get statistics:', error);
        return {
          totalEvents: 0,
          criticalEvents: 0,
          failedLogins: 0,
          permissionChanges: 0,
          suspiciousActivities: 0,
          unresolvedEvents: 0
        };
      }

      const events = data || [];
      return {
        totalEvents: events.length,
        criticalEvents: events.filter(e => e.severity === 'critical').length,
        failedLogins: events.filter(e => e.event_type === 'failed_login').length,
        permissionChanges: events.filter(e => e.event_type === 'permission_change').length,
        suspiciousActivities: events.filter(e => e.event_type === 'suspicious_activity').length,
        unresolvedEvents: events.filter(e => !e.resolved).length
      };
    } catch (error) {
      console.error('[Security] Error getting statistics:', error);
      return {
        totalEvents: 0,
        criticalEvents: 0,
        failedLogins: 0,
        permissionChanges: 0,
        suspiciousActivities: 0,
        unresolvedEvents: 0
      };
    }
  }
};
