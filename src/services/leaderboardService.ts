import { supabase } from '@/integrations/supabase/client';
import type { AdminAchievements } from '@/types/badge';
import type { AdminPerformanceStats } from './securityAlertStatsService';
import type { Json } from '@/integrations/supabase/types';

export interface LeaderboardEntry {
  id: string;
  month_year: string;
  admin_id: string;
  admin_name: string;
  admin_phone: string;
  rank: number;
  score: number;
  badges_earned: Json;
  level: number;
  total_alerts: number;
  confirmation_rate: number;
  avg_response_time_minutes: number | null;
  created_at: string;
}

export interface MonthlyWinner {
  month_year: string;
  winners: LeaderboardEntry[];
}

class LeaderboardService {
  /**
   * Salva snapshot do leaderboard do mês atual
   */
  async saveMonthlySnapshot(): Promise<void> {
    const { error } = await supabase.rpc('save_monthly_leaderboard');
    if (error) {
      console.error('Error saving monthly leaderboard:', error);
      throw error;
    }
  }

  /**
   * Busca leaderboard do mês atual
   */
  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const { data, error } = await supabase
      .from('admin_leaderboard_history')
      .select('*')
      .eq('month_year', currentMonth)
      .order('rank', { ascending: true });

    if (error) {
      console.error('Error fetching current leaderboard:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Busca leaderboard de um mês específico
   */
  async getLeaderboardByMonth(monthYear: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('admin_leaderboard_history')
      .select('*')
      .eq('month_year', monthYear)
      .order('rank', { ascending: true });

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Busca histórico de vencedores mensais (top 3)
   */
  async getMonthlyWinners(): Promise<MonthlyWinner[]> {
    const { data, error } = await supabase
      .from('admin_leaderboard_history')
      .select('*')
      .lte('rank', 3)
      .order('month_year', { ascending: false })
      .order('rank', { ascending: true });

    if (error) {
      console.error('Error fetching monthly winners:', error);
      throw error;
    }

    // Agrupar por mês
    const grouped = (data || []).reduce((acc, entry) => {
      if (!acc[entry.month_year]) {
        acc[entry.month_year] = [];
      }
      acc[entry.month_year].push(entry);
      return acc;
    }, {} as Record<string, LeaderboardEntry[]>);

    return Object.entries(grouped).map(([month_year, winners]) => ({
      month_year,
      winners
    }));
  }

  /**
   * Busca meses disponíveis no histórico
   */
  async getAvailableMonths(): Promise<string[]> {
    const { data, error } = await supabase
      .from('admin_leaderboard_history')
      .select('month_year')
      .order('month_year', { ascending: false });

    if (error) {
      console.error('Error fetching available months:', error);
      throw error;
    }

    const uniqueMonths = [...new Set((data || []).map(d => d.month_year))];
    return uniqueMonths;
  }

  /**
   * Busca histórico de performance de um admin específico
   */
  async getAdminHistory(adminId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('admin_leaderboard_history')
      .select('*')
      .eq('admin_id', adminId)
      .order('month_year', { ascending: false });

    if (error) {
      console.error('Error fetching admin history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Formata o nome do mês para exibição
   */
  formatMonthYear(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  /**
   * Retorna emoji baseado no rank
   */
  getRankEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }
}

// Singleton
let instance: LeaderboardService | null = null;

export function getLeaderboardService(): LeaderboardService {
  if (!instance) {
    instance = new LeaderboardService();
  }
  return instance;
}

export { LeaderboardService };
