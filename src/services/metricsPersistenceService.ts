import { supabase } from '@/integrations/supabase/client';
import { WebSocketMetrics } from './websocketMetricsService';
import { SystemHealthStatus } from './systemHealthService';

export interface MetricsSnapshotRecord {
  id?: string;
  timestamp?: string;
  metrics_type: string;
  total_connections: number;
  successful_connections: number;
  failed_connections: number;
  current_connection_attempt: number;
  average_connection_time: number;
  last_connection_time: number;
  total_uptime: number;
  total_downtime: number;
  total_reconnections: number;
  reconnection_rate: number;
  average_time_between_reconnections: number;
  longest_uptime_period: number;
  average_latency: number;
  min_latency: number;
  max_latency: number;
  latency_history: number[];
  total_events_sent: number;
  total_events_received: number;
  events_failed?: number;
  current_status: string;
  fallback_mode_activations: number;
  created_at?: string;
}

export interface HealthSnapshotRecord {
  id?: string;
  timestamp?: string;
  overall_status: string;
  websocket_status: string;
  websocket_latency: number | null;
  websocket_error: string | null;
  supabase_status: string;
  supabase_latency: number | null;
  supabase_error: string | null;
  whatsapp_status: string;
  whatsapp_latency: number | null;
  whatsapp_error: string | null;
  smartone_status: string;
  smartone_latency: number | null;
  smartone_error: string | null;
  created_at?: string;
}

export interface PeriodComparison {
  metric_name: string;
  period1_value: number;
  period2_value: number;
  change_percent: number;
}

class MetricsPersistenceService {
  private isEnabled: boolean = false;
  private saveInterval: number | null = null;
  private saveIntervalMs: number = 60000; // Save every minute

  constructor() {
    this.checkTablesExist();
  }

  private async checkTablesExist() {
    try {
      const { error } = await supabase
        .from('metrics_snapshots' as any)
        .select('id')
        .limit(1);
      
      if (!error) {
        this.isEnabled = true;
        console.log('[MetricsPersistence] Tabelas encontradas, persistência habilitada');
      } else {
        console.warn('[MetricsPersistence] Tabelas não encontradas:', error.message);
        this.isEnabled = false;
      }
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao verificar tabelas:', error);
      this.isEnabled = false;
    }
  }

  async saveMetricsSnapshot(metrics: WebSocketMetrics): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('[MetricsPersistence] Persistência desabilitada, snapshot não salvo');
      return false;
    }

    try {
      const record: MetricsSnapshotRecord = {
        metrics_type: 'websocket',
        total_connections: metrics.totalConnections,
        successful_connections: metrics.successfulConnections,
        failed_connections: metrics.failedConnections,
        current_connection_attempt: metrics.currentConnectionAttempt,
        average_connection_time: metrics.averageConnectionTime,
        last_connection_time: metrics.lastConnectionTime,
        total_uptime: metrics.totalUptime,
        total_downtime: metrics.totalDowntime,
        total_reconnections: metrics.totalReconnections,
        reconnection_rate: metrics.reconnectionRate,
        average_time_between_reconnections: metrics.averageTimeBetweenReconnections,
        longest_uptime_period: metrics.longestUptimePeriod,
        average_latency: metrics.averageLatency,
        min_latency: metrics.minLatency,
        max_latency: metrics.maxLatency,
        latency_history: metrics.latencyHistory,
        total_events_sent: metrics.totalEventsSent,
        total_events_received: metrics.totalEventsReceived,
        events_failed: metrics.failedEvents || 0,
        current_status: metrics.currentStatus,
        fallback_mode_activations: metrics.fallbackModeActivations,
      };

      const { error } = await supabase
        .from('metrics_snapshots' as any)
        .insert(record);

      if (error) {
        console.error('[MetricsPersistence] Erro ao salvar snapshot:', error);
        return false;
      }

      console.log('[MetricsPersistence] Snapshot salvo com sucesso');
      return true;
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao salvar snapshot:', error);
      return false;
    }
  }

  async saveHealthSnapshot(health: SystemHealthStatus): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const record: HealthSnapshotRecord = {
        overall_status: health.overall,
        websocket_status: health.services.websocket.status,
        websocket_latency: health.services.websocket.latency,
        websocket_error: health.services.websocket.error || null,
        supabase_status: health.services.supabase.status,
        supabase_latency: health.services.supabase.latency,
        supabase_error: health.services.supabase.error || null,
        whatsapp_status: health.services.whatsapp.status,
        whatsapp_latency: health.services.whatsapp.latency,
        whatsapp_error: health.services.whatsapp.error || null,
        smartone_status: health.services.smartone.status,
        smartone_latency: health.services.smartone.latency,
        smartone_error: health.services.smartone.error || null,
      };

      const { error } = await supabase
        .from('health_snapshots' as any)
        .insert(record);

      if (error) {
        console.error('[MetricsPersistence] Erro ao salvar health snapshot:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao salvar health snapshot:', error);
      return false;
    }
  }

  async getMetricsForPeriod(
    startTime: Date,
    endTime: Date,
    metricsType: string = 'websocket'
  ): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('metrics_snapshots' as any)
        .select('*')
        .eq('metrics_type', metricsType)
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', endTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('[MetricsPersistence] Erro ao buscar métricas:', error);
        return [];
      }

      return (data as any[]) || [];
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao buscar métricas:', error);
      return [];
    }
  }

  async getHealthForPeriod(
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('health_snapshots' as any)
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', endTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('[MetricsPersistence] Erro ao buscar health:', error);
        return [];
      }

      return (data as any[]) || [];
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao buscar health:', error);
      return [];
    }
  }

  async comparePeriods(
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date
  ): Promise<PeriodComparison[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .rpc('compare_periods' as any, {
          period1_start: period1Start.toISOString(),
          period1_end: period1End.toISOString(),
          period2_start: period2Start.toISOString(),
          period2_end: period2End.toISOString(),
        });

      if (error) {
        console.error('[MetricsPersistence] Erro ao comparar períodos:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao comparar períodos:', error);
      return [];
    }
  }

  async getHourlyMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .rpc('get_hourly_metrics' as any, {
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        });

      if (error) {
        console.error('[MetricsPersistence] Erro ao buscar métricas horárias:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[MetricsPersistence] Erro ao buscar métricas horárias:', error);
      return [];
    }
  }

  startAutoSave(
    getMetrics: () => WebSocketMetrics,
    getHealth: () => SystemHealthStatus
  ) {
    if (this.saveInterval) {
      console.log('[MetricsPersistence] Auto-save já está rodando');
      return;
    }

    console.log('[MetricsPersistence] Iniciando auto-save a cada', this.saveIntervalMs / 1000, 'segundos');

    this.saveInterval = window.setInterval(async () => {
      if (this.isEnabled) {
        const metrics = getMetrics();
        const health = getHealth();
        
        await Promise.all([
          this.saveMetricsSnapshot(metrics),
          this.saveHealthSnapshot(health),
        ]);
      }
    }, this.saveIntervalMs);
  }

  stopAutoSave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      console.log('[MetricsPersistence] Auto-save parado');
    }
  }

  isPeristenceEnabled(): boolean {
    return this.isEnabled;
  }

  async retryEnabling() {
    await this.checkTablesExist();
    return this.isEnabled;
  }
}

// Singleton
let persistenceServiceInstance: MetricsPersistenceService | null = null;

export function getMetricsPersistenceService(): MetricsPersistenceService {
  if (!persistenceServiceInstance) {
    persistenceServiceInstance = new MetricsPersistenceService();
  }
  return persistenceServiceInstance;
}
