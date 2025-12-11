// Simplified Suspicious Login Service
import { supabase } from '@/integrations/supabase/client';

export interface SuspiciousLoginCheck {
  suspicious: boolean;
  should_block: boolean;
  alert_admins: boolean;
  attempt_count: number;
}

export const suspiciousLoginService = {
  async checkLogin(ipAddress: string, email?: string): Promise<SuspiciousLoginCheck | null> {
    try {
      const { data, error } = await supabase.rpc('check_suspicious_login', {
        _ip_address: ipAddress,
        _email: email || ''
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

  async getRecentAttempts(limit: number = 50): Promise<any[]> {
    // Table 'suspicious_login_attempts' doesn't exist
    console.log('[SuspiciousLogin] getRecentAttempts - placeholder');
    return [];
  },

  async getBlockedAttempts(limit: number = 50): Promise<any[]> {
    // Table 'suspicious_login_attempts' doesn't exist
    console.log('[SuspiciousLogin] getBlockedAttempts - placeholder');
    return [];
  },

  async getAttemptsRequiringAlert(): Promise<any[]> {
    // Table 'suspicious_login_attempts' doesn't exist
    console.log('[SuspiciousLogin] getAttemptsRequiringAlert - placeholder');
    return [];
  }
};
