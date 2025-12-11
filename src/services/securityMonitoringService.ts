// Simplified Security Monitoring Service
import { supabase } from "@/integrations/supabase/client";

export interface SecurityEvent {
  id?: string;
  event_type: string;
  severity: string;
  ip_address?: string;
  user_agent?: string;
  event_details?: any;
  created_at?: string;
}

export const securityMonitoringService = {
  async logEvent(event: Omit<SecurityEvent, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert({
          event_type: event.event_type,
          severity: event.severity,
          ip_address: event.ip_address,
          user_agent: event.user_agent,
          event_details: event.event_details,
        });

      if (error) {
        console.error('[Security] Failed to log event:', error);
      }
    } catch (error) {
      console.error('[Security] Error logging event:', error);
    }
  },

  async logFailedLogin(
    email: string, 
    ipAddress?: string, 
    userAgent?: string,
    passwordAttempted?: boolean
  ): Promise<void> {
    await this.logEvent({
      event_type: 'failed_login',
      severity: 'warning',
      ip_address: ipAddress,
      user_agent: userAgent,
      event_details: { 
        email, 
        passwordAttempted: passwordAttempted || false,
        timestamp: new Date().toISOString() 
      }
    });
  },

  async logSuspiciousActivity(
    description: string,
    userId?: string,
    severity: string = 'warning',
    details?: any
  ): Promise<void> {
    await this.logEvent({
      event_type: 'suspicious_activity',
      severity,
      event_details: { description, userId, ...details, timestamp: new Date().toISOString() }
    });
  },

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

  async logUnauthorizedAccess(
    resource: string,
    userId?: string,
    ipAddress?: string,
    details?: any
  ): Promise<void> {
    await this.logEvent({
      event_type: 'unauthorized_access',
      severity: 'warning',
      ip_address: ipAddress,
      event_details: { resource, userId, ...details, timestamp: new Date().toISOString() }
    });
  },

  async fetchEvents(filters?: {
    eventType?: string;
    severity?: string;
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

  async resolveEvent(eventId: string): Promise<boolean> {
    // Column 'resolved' doesn't exist on security_events table
    console.log('[Security] resolveEvent - placeholder (resolved column not available)');
    return true;
  },

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
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };

      const since = new Date(Date.now() - intervals[timeRange]).toISOString();

      const { data, error } = await supabase
        .from('security_events')
        .select('event_type, severity')
        .gte('created_at', since);

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
        unresolvedEvents: 0 // Column doesn't exist
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
