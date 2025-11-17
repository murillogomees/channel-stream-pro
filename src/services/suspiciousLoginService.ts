/**
 * SERVIÇO DE DETECÇÃO DE LOGINS SUSPEITOS
 * 
 * Detecta e alerta sobre tentativas de login suspeitas
 */

import { supabase } from '@/integrations/supabase/client';

export interface SuspiciousLoginCheck {
  suspicious: boolean;
  should_block: boolean;
  alert_admins: boolean;
  attempt_count: number;
}

export const suspiciousLoginService = {
  /**
   * Verifica se uma tentativa de login é suspeita
   */
  async checkLogin(ipAddress: string, email?: string): Promise<SuspiciousLoginCheck | null> {
    try {
      const { data, error } = await supabase.rpc('check_suspicious_login', {
        _ip_address: ipAddress,
        _email: email
      });

      if (error) {
        console.error('[SuspiciousLogin] Erro ao verificar:', error);
        return null;
      }

      return data as unknown as SuspiciousLoginCheck;
    } catch (error) {
      console.error('[SuspiciousLogin] Erro ao verificar:', error);
      return null;
    }
  },

  /**
   * Busca tentativas suspeitas recentes
   */
  async getRecentAttempts(limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('suspicious_login_attempts')
        .select('*')
        .order('last_attempt_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[SuspiciousLogin] Erro ao buscar tentativas:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[SuspiciousLogin] Erro ao buscar tentativas:', error);
      return [];
    }
  },

  /**
   * Busca tentativas bloqueadas
   */
  async getBlockedAttempts(limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('suspicious_login_attempts')
        .select('*')
        .eq('blocked', true)
        .order('last_attempt_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[SuspiciousLogin] Erro ao buscar bloqueados:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[SuspiciousLogin] Erro ao buscar bloqueados:', error);
      return [];
    }
  },

  /**
   * Busca tentativas que requerem alerta
   */
  async getAttemptsRequiringAlert() {
    try {
      const { data, error } = await supabase
        .from('suspicious_login_attempts')
        .select('*')
        .eq('alert_sent', false)
        .gte('attempt_count', 3)
        .order('last_attempt_at', { ascending: false });

      if (error) {
        console.error('[SuspiciousLogin] Erro ao buscar alertas pendentes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[SuspiciousLogin] Erro ao buscar alertas pendentes:', error);
      return [];
    }
  }
};
