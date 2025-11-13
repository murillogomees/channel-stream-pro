import { NotificationLog } from '@/types/whatsapp';
import { format, startOfDay, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DailyStats {
  date: string;
  success: number;
  error: number;
  total: number;
  successRate: number;
}

export interface TypeStats {
  type: string;
  count: number;
  successCount: number;
  errorCount: number;
  successRate: number;
}

export interface OverallStats {
  totalSent: number;
  totalSuccess: number;
  totalErrors: number;
  overallSuccessRate: number;
  avgDailyRate: number;
  last24hSuccess: number;
  last24hErrors: number;
  last7DaysSuccess: number;
  last7DaysErrors: number;
}

export class NotificationStatsService {
  private logs: NotificationLog[];

  constructor(logs: NotificationLog[]) {
    this.logs = logs;
  }

  getOverallStats(): OverallStats {
    const totalSent = this.logs.length;
    const totalSuccess = this.logs.filter(log => log.status === 'success').length;
    const totalErrors = this.logs.filter(log => log.status === 'error').length;
    const overallSuccessRate = totalSent > 0 ? (totalSuccess / totalSent) * 100 : 0;

    const now = new Date();
    const last24h = subDays(now, 1);
    const last7Days = subDays(now, 7);

    const last24hLogs = this.logs.filter(log => 
      new Date(log.dataEnvio) >= last24h
    );
    const last7DaysLogs = this.logs.filter(log => 
      new Date(log.dataEnvio) >= last7Days
    );

    const last24hSuccess = last24hLogs.filter(log => log.status === 'success').length;
    const last24hErrors = last24hLogs.filter(log => log.status === 'error').length;
    const last7DaysSuccess = last7DaysLogs.filter(log => log.status === 'success').length;
    const last7DaysErrors = last7DaysLogs.filter(log => log.status === 'error').length;

    const dailyStats = this.getDailyStats(30);
    const avgDailyRate = dailyStats.length > 0 
      ? dailyStats.reduce((sum, day) => sum + day.successRate, 0) / dailyStats.length 
      : 0;

    return {
      totalSent,
      totalSuccess,
      totalErrors,
      overallSuccessRate,
      avgDailyRate,
      last24hSuccess,
      last24hErrors,
      last7DaysSuccess,
      last7DaysErrors,
    };
  }

  getDailyStats(days: number = 30): DailyStats[] {
    const now = new Date();
    const startDate = subDays(now, days);
    
    const dailyMap = new Map<string, { success: number; error: number; total: number }>();

    // Inicializar todos os dias com zero
    for (let i = 0; i < days; i++) {
      const date = format(subDays(now, i), 'yyyy-MM-dd');
      dailyMap.set(date, { success: 0, error: 0, total: 0 });
    }

    // Contar logs por dia
    this.logs
      .filter(log => new Date(log.dataEnvio) >= startDate)
      .forEach(log => {
        const date = format(new Date(log.dataEnvio), 'yyyy-MM-dd');
        const stats = dailyMap.get(date);
        if (stats) {
          stats.total++;
          if (log.status === 'success') {
            stats.success++;
          } else {
            stats.error++;
          }
        }
      });

    // Converter para array e calcular taxa de sucesso
    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        success: stats.success,
        error: stats.error,
        total: stats.total,
        successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getTypeStats(): TypeStats[] {
    const typeMap = new Map<string, { count: number; successCount: number; errorCount: number }>();

    this.logs.forEach(log => {
      const type = log.tipo || 'Não especificado';
      const stats = typeMap.get(type) || { count: 0, successCount: 0, errorCount: 0 };
      
      stats.count++;
      if (log.status === 'success') {
        stats.successCount++;
      } else {
        stats.errorCount++;
      }
      
      typeMap.set(type, stats);
    });

    return Array.from(typeMap.entries())
      .map(([type, stats]) => ({
        type,
        count: stats.count,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
        successRate: stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  getRecentActivity(limit: number = 10): NotificationLog[] {
    return [...this.logs]
      .sort((a, b) => new Date(b.dataEnvio).getTime() - new Date(a.dataEnvio).getTime())
      .slice(0, limit);
  }

  getErrorAnalysis() {
    const errors = this.logs.filter(log => log.status === 'error' && log.erro);
    const errorMap = new Map<string, number>();

    errors.forEach(log => {
      const error = log.erro || 'Erro desconhecido';
      errorMap.set(error, (errorMap.get(error) || 0) + 1);
    });

    return Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  getHourlyDistribution() {
    const hourMap = new Map<number, { success: number; error: number }>();

    // Inicializar todas as horas
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { success: 0, error: 0 });
    }

    this.logs.forEach(log => {
      const hour = new Date(log.dataEnvio).getHours();
      const stats = hourMap.get(hour)!;
      if (log.status === 'success') {
        stats.success++;
      } else {
        stats.error++;
      }
    });

    return Array.from(hourMap.entries())
      .map(([hour, stats]) => ({
        hour: `${hour}:00`,
        success: stats.success,
        error: stats.error,
        total: stats.success + stats.error,
      }));
  }
}
