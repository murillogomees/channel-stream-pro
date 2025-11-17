import { supabase } from '@/integrations/supabase/client';

export interface PlaylistHealthCheck {
  id: string;
  client_id: string;
  playlist_id: string;
  m3u_url: string;
  status: 'pending' | 'active' | 'inactive' | 'error';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
  last_checked_at: string;
  created_at: string;
}

export interface PlaylistHealthStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
  avgResponseTime: number;
  lastCheck?: string;
}

class PlaylistHealthService {
  /**
   * Executa verificação manual de saúde das playlists
   */
  async runHealthCheck(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      const { data, error } = await supabase.functions.invoke('check-playlist-health', {
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
   * Busca histórico de health checks de um cliente específico
   */
  async getClientHealthHistory(clientId: string, limit: number = 10): Promise<PlaylistHealthCheck[]> {
    try {
      const { data, error } = await supabase
        .from('playlist_health_checks')
        .select('*')
        .eq('client_id', clientId)
        .order('last_checked_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
      }

      return (data || []) as PlaylistHealthCheck[];
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return [];
    }
  }

  /**
   * Busca estatísticas gerais de saúde das playlists
   */
  async getHealthStats(): Promise<PlaylistHealthStats> {
    try {
      // Buscar últimas verificações de cada cliente
      const { data: latestChecks, error } = await supabase
        .from('playlist_health_checks')
        .select('*')
        .order('last_checked_at', { ascending: false });

      if (error || !latestChecks) {
        console.error('Erro ao buscar estatísticas:', error);
        return {
          total: 0,
          active: 0,
          inactive: 0,
          error: 0,
          avgResponseTime: 0,
        };
      }

      // Agrupar por client_id e pegar o mais recente
      const uniqueChecks = new Map<string, PlaylistHealthCheck>();
      (latestChecks as PlaylistHealthCheck[]).forEach((check) => {
        if (!uniqueChecks.has(check.client_id)) {
          uniqueChecks.set(check.client_id, check);
        }
      });

      const recentChecks = Array.from(uniqueChecks.values());

      const stats: PlaylistHealthStats = {
        total: recentChecks.length,
        active: recentChecks.filter(c => c.status === 'active').length,
        inactive: recentChecks.filter(c => c.status === 'inactive').length,
        error: recentChecks.filter(c => c.status === 'error').length,
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
      console.error('Erro ao calcular estatísticas:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        error: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Busca último status de saúde de um cliente
   */
  async getClientLatestHealth(clientId: string): Promise<PlaylistHealthCheck | null> {
    try {
      const { data, error } = await supabase
        .from('playlist_health_checks')
        .select('*')
        .eq('client_id', clientId)
        .order('last_checked_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        return null;
      }

      return data as PlaylistHealthCheck;
    } catch (error) {
      return null;
    }
  }

  /**
   * Limpa health checks antigos (mantém últimos 30 dias)
   */
  async cleanOldHealthChecks(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await supabase
        .from('playlist_health_checks')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('Erro ao limpar health checks antigos:', error);
      }
    } catch (error) {
      console.error('Erro ao limpar health checks:', error);
    }
  }
}

export const playlistHealthService = new PlaylistHealthService();
