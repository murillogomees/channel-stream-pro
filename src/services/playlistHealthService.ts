import { supabase } from '@/integrations/supabase/client';

export interface PlaylistHealthCheck {
  id: string;
  client_id: string; // Used as m3u_list_id
  playlist_id: string;
  m3u_url: string;
  status: 'pending' | 'active' | 'inactive' | 'error';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
  last_checked_at: string;
  created_at: string;
  snoozed_until?: string | null;
}

export interface PlaylistHealthStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
  avgResponseTime: number;
  lastCheck?: string;
}

export interface M3UListWithHealth {
  id: string;
  name: string;
  file_url: string;
  status: string;
  lastCheck?: PlaylistHealthCheck;
}

class PlaylistHealthService {
  /**
   * Executa verificação manual de saúde das playlists M3U
   */
  async runHealthCheck(): Promise<{ success: boolean; message: string; stats?: any; results?: any[] }> {
    try {
      console.log('🔍 Iniciando verificação de saúde das listas M3U...');
      
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

      console.log('✅ Verificação concluída:', data);

      return {
        success: data?.success ?? true,
        message: data?.message || 'Verificação concluída',
        stats: data?.stats,
        results: data?.results,
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
   * Busca estatísticas gerais de saúde das playlists
   */
  async getHealthStats(): Promise<PlaylistHealthStats> {
    try {
      // Buscar últimas verificações de cada lista
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

      // Agrupar por playlist_id e pegar o mais recente
      const uniqueChecks = new Map<string, PlaylistHealthCheck>();
      (latestChecks as PlaylistHealthCheck[]).forEach((check) => {
        if (!uniqueChecks.has(check.playlist_id)) {
          uniqueChecks.set(check.playlist_id, check);
        }
      });

      const recentChecks = Array.from(uniqueChecks.values());

      const stats: PlaylistHealthStats = {
        total: recentChecks.length,
        active: recentChecks.filter(c => c.status === 'active').length,
        inactive: recentChecks.filter(c => c.status === 'inactive').length,
        error: recentChecks.filter(c => c.status === 'error').length,
        avgResponseTime: recentChecks.length > 0
          ? Math.round(
              recentChecks
                .filter(c => c.response_time_ms)
                .reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / 
              (recentChecks.filter(c => c.response_time_ms).length || 1)
            )
          : 0,
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
   * Busca todas as listas M3U com seu último health check
   */
  async getM3UListsWithHealth(): Promise<M3UListWithHealth[]> {
    try {
      // Buscar listas M3U
      const { data: lists, error: listsError } = await supabase
        .from('m3u_lists')
        .select('id, name, file_url, status')
        .eq('status', 'active')
        .order('name');

      if (listsError || !lists) {
        console.error('Erro ao buscar listas:', listsError);
        return [];
      }

      // Buscar últimos health checks
      const { data: checks, error: checksError } = await supabase
        .from('playlist_health_checks')
        .select('*')
        .order('last_checked_at', { ascending: false });

      if (checksError) {
        console.error('Erro ao buscar health checks:', checksError);
      }

      // Agrupar checks por playlist_id
      const checksByList = new Map<string, PlaylistHealthCheck>();
      (checks as PlaylistHealthCheck[] || []).forEach((check) => {
        if (!checksByList.has(check.playlist_id)) {
          checksByList.set(check.playlist_id, check);
        }
      });

      // Combinar listas com seus health checks
      return lists.map(list => ({
        id: list.id,
        name: list.name,
        file_url: list.file_url,
        status: list.status,
        lastCheck: checksByList.get(list.id),
      }));
    } catch (error) {
      console.error('Erro ao buscar listas com health:', error);
      return [];
    }
  }

  /**
   * Busca todas as verificações de playlists
   */
  async getAllHealthChecks(): Promise<PlaylistHealthCheck[]> {
    try {
      const { data, error } = await supabase
        .from('playlist_health_checks')
        .select('*')
        .order('last_checked_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar verificações:', error);
        return [];
      }

      // Agrupar por playlist_id e pegar o mais recente
      const uniqueChecks = new Map<string, PlaylistHealthCheck>();
      (data as PlaylistHealthCheck[] || []).forEach((check) => {
        if (!uniqueChecks.has(check.playlist_id)) {
          uniqueChecks.set(check.playlist_id, check);
        }
      });

      return Array.from(uniqueChecks.values());
    } catch (error) {
      console.error('Erro ao buscar verificações:', error);
      return [];
    }
  }

  /**
   * Define um snooze para uma playlist específica
   */
  async snoozePlaylist(playlistId: string, hours: number): Promise<{ success: boolean; message: string }> {
    try {
      const snoozedUntil = new Date();
      snoozedUntil.setHours(snoozedUntil.getHours() + hours);

      const { error } = await supabase
        .from('playlist_health_checks')
        .update({ snoozed_until: snoozedUntil.toISOString() })
        .eq('playlist_id', playlistId);

      if (error) {
        console.error('Erro ao configurar snooze:', error);
        return {
          success: false,
          message: 'Erro ao configurar snooze',
        };
      }

      return {
        success: true,
        message: `Alertas pausados por ${hours} horas`,
      };
    } catch (error: any) {
      console.error('Erro ao configurar snooze:', error);
      return {
        success: false,
        message: error.message || 'Erro desconhecido',
      };
    }
  }

  /**
   * Remove o snooze de uma playlist
   */
  async unsnoozePlaylist(playlistId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('playlist_health_checks')
        .update({ snoozed_until: null })
        .eq('playlist_id', playlistId);

      if (error) {
        console.error('Erro ao remover snooze:', error);
        return {
          success: false,
          message: 'Erro ao reativar alertas',
        };
      }

      return {
        success: true,
        message: 'Alertas reativados',
      };
    } catch (error: any) {
      console.error('Erro ao remover snooze:', error);
      return {
        success: false,
        message: error.message || 'Erro desconhecido',
      };
    }
  }

  /**
   * Busca histórico de health checks de uma lista M3U específica
   */
  async getListHealthHistory(listId: string, limit: number = 10): Promise<PlaylistHealthCheck[]> {
    try {
      const { data, error } = await supabase
        .from('playlist_health_checks')
        .select('*')
        .eq('playlist_id', listId)
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
}

export const playlistHealthService = new PlaylistHealthService();
