import { supabase } from '@/integrations/supabase/client';

export interface M3UHealthCheck {
  id: string;
  m3u_list_id: string;
  status: 'healthy' | 'error' | 'warning';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
  channel_count?: number;
  last_checked_at: string;
  created_at: string;
}

export interface M3UHealthStats {
  total: number;
  healthy: number;
  error: number;
  warning: number;
  avgResponseTime: number;
  lastCheck?: string;
}

class M3UHealthService {
  /**
   * Executa verificação manual de saúde das listas M3U
   */
  async runHealthCheck(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      const { data, error } = await supabase.functions.invoke('check-m3u-health', {
        method: 'POST',
      });

      if (error) {
        console.error('Erro ao executar health check:', error);
        return {
          success: false,
          message: error.message || 'Erro ao executar verificação',
        };
      }

      return {
        success: true,
        message: data.message || 'Verificação concluída',
        stats: data.stats,
      };
    } catch (error: any) {
      console.error('Erro ao chamar função de health check:', error);
      return {
        success: false,
        message: error.message || 'Erro desconhecido',
      };
    }
  }

  /**
   * Busca estatísticas gerais de saúde das listas M3U
   */
  async getHealthStats(): Promise<M3UHealthStats> {
    try {
      const { data, error } = await supabase
        .from('m3u_health_checks')
        .select('*')
        .order('last_checked_at', { ascending: false });

      if (error || !data) {
        console.error('Erro ao buscar estatísticas:', error);
        return {
          total: 0,
          healthy: 0,
          error: 0,
          warning: 0,
          avgResponseTime: 0,
        };
      }

      // Agrupar por m3u_list_id e pegar o mais recente
      const uniqueChecks = new Map<string, M3UHealthCheck>();
      (data as M3UHealthCheck[]).forEach((check) => {
        if (!uniqueChecks.has(check.m3u_list_id)) {
          uniqueChecks.set(check.m3u_list_id, check);
        }
      });

      const recentChecks = Array.from(uniqueChecks.values());

      const stats: M3UHealthStats = {
        total: recentChecks.length,
        healthy: recentChecks.filter(c => c.status === 'healthy').length,
        error: recentChecks.filter(c => c.status === 'error').length,
        warning: recentChecks.filter(c => c.status === 'warning').length,
        avgResponseTime: Math.round(
          recentChecks
            .filter(c => c.response_time_ms)
            .reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / 
          (recentChecks.filter(c => c.response_time_ms).length || 1)
        ),
        lastCheck: recentChecks[0]?.last_checked_at,
      };

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        total: 0,
        healthy: 0,
        error: 0,
        warning: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Busca histórico de health checks de uma lista M3U específica
   */
  async getM3UHealthHistory(m3uListId: string, limit: number = 10): Promise<M3UHealthCheck[]> {
    try {
      const { data, error } = await supabase
        .from('m3u_health_checks')
        .select('*')
        .eq('m3u_list_id', m3uListId)
        .order('last_checked_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
      }

      return (data || []) as M3UHealthCheck[];
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return [];
    }
  }

  /**
   * Silencia alertas de uma lista M3U por um período
   */
  async snoozeAlerts(m3uListId: string, hours: number): Promise<boolean> {
    try {
      const snoozedUntil = new Date();
      snoozedUntil.setHours(snoozedUntil.getHours() + hours);

      const { error } = await supabase
        .from('m3u_lists')
        .update({ 
          health_snoozed_until: snoozedUntil.toISOString() 
        })
        .eq('id', m3uListId);

      if (error) {
        console.error('Erro ao silenciar alertas:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao silenciar alertas:', error);
      return false;
    }
  }
}

export const m3uHealthService = new M3UHealthService();
