/**
 * Auth Logging Service - Simplified
 */

import { supabase } from '@/integrations/supabase/client';

export type AuthEventType = 'login' | 'logout' | 'session_refresh' | 'access_denied';

export const authLoggingService = {
  async logEvent({
    userId,
    userEmail,
    eventType,
    ipAddress,
    userAgent,
    metadata = {}
  }: {
    userId: string;
    userEmail: string;
    eventType: AuthEventType;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { error } = await supabase
        .from('auth_sessions_log')
        .insert({
          user_id: userId,
          user_email: userEmail,
          event_type: eventType,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata
        });
      
      // Silently ignore all errors - auth logging is non-critical
      // RLS errors (42501) are expected on self-hosted with custom auth
      if (error) {
        // Silent fail - don't log to console to avoid spam
      }
    } catch (error) {
      // Silently fail - logging is non-critical
    }
  },

  async logLogin(userId: string, userEmail: string, metadata?: Record<string, any>) {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    
    await this.logEvent({
      userId,
      userEmail,
      eventType: 'login',
      userAgent,
      metadata
    });
  },

  async logLogout(userId: string, userEmail: string) {
    await this.logEvent({
      userId,
      userEmail,
      eventType: 'logout'
    });
  },

  async logAccessDenied(userId: string, userEmail: string, reason: string, path: string) {
    await this.logEvent({
      userId,
      userEmail,
      eventType: 'access_denied',
      metadata: { reason, path }
    });
  },

  async getStatistics(days: number = 7) {
    try {
      const { data, error } = await supabase.rpc('get_auth_statistics', { days });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AuthLogging] Erro ao buscar estatísticas:', error);
      return [];
    }
  },

  async getActiveSessions() {
    try {
      const { data, error } = await supabase.rpc('get_active_sessions');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[AuthLogging] Erro ao buscar sessões ativas:', error);
      return [];
    }
  },

  async getRecentLogins(limit: number = 50) {
    const { data, error } = await supabase
      .from('auth_sessions_log')
      .select('*')
      .in('event_type', ['login', 'logout'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AuthLogging] Erro ao buscar logins recentes:', error);
      return [];
    }

    return data || [];
  },
};
