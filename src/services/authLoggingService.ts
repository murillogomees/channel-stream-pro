/**
 * SERVIÇO DE LOGGING DE AUTENTICAÇÃO
 * 
 * Registra eventos de autenticação para monitoramento e auditoria
 */

import { supabase } from '@/integrations/supabase/client';

export type AuthEventType = 'login' | 'logout' | 'session_refresh' | 'access_denied';

interface LogAuthEventParams {
  userId: string;
  userEmail: string;
  eventType: AuthEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export const authLoggingService = {
  /**
   * Registra evento de autenticação
   */
  async logEvent({
    userId,
    userEmail,
    eventType,
    ipAddress,
    userAgent,
    metadata = {}
  }: LogAuthEventParams) {
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

      if (error) {
        console.error('[AuthLogging] Erro ao registrar evento:', error);
      }
    } catch (error) {
      console.error('[AuthLogging] Erro ao registrar evento:', error);
    }
  },

  /**
   * Registra login bem-sucedido
   */
  async logLogin(userId: string, userEmail: string, metadata?: Record<string, any>) {
    const userAgent = navigator.userAgent;
    
    await this.logEvent({
      userId,
      userEmail,
      eventType: 'login',
      userAgent,
      metadata
    });
  },

  /**
   * Registra logout
   */
  async logLogout(userId: string, userEmail: string) {
    await this.logEvent({
      userId,
      userEmail,
      eventType: 'logout'
    });
  },

  /**
   * Registra acesso negado
   */
  async logAccessDenied(userId: string, userEmail: string, reason: string, path: string) {
    await this.logEvent({
      userId,
      userEmail,
      eventType: 'access_denied',
      metadata: { reason, path }
    });
  },

  /**
   * Busca estatísticas de autenticação
   */
  async getStatistics(days: number = 7) {
    const { data, error } = await supabase
      .rpc('get_auth_statistics', { _days: days });

    if (error) {
      console.error('[AuthLogging] Erro ao buscar estatísticas:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Busca sessões ativas
   */
  async getActiveSessions() {
    const { data, error } = await supabase
      .rpc('get_active_sessions');

    if (error) {
      console.error('[AuthLogging] Erro ao buscar sessões ativas:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Busca histórico de logins recentes
   */
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

  /**
   * Busca tentativas de acesso negado
   */
  async getAccessDeniedAttempts(limit: number = 50) {
    const { data, error } = await supabase
      .from('auth_sessions_log')
      .select('*')
      .eq('event_type', 'access_denied')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AuthLogging] Erro ao buscar acessos negados:', error);
      return [];
    }

    return data || [];
  }
};
