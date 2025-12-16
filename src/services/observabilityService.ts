import { supabase } from '@/integrations/supabase/client';

export interface OverviewMetrics {
  totalChannels: number;
  healthyChannels: number;
  activeUsers24h: number;
  totalViews24h: number;
  avgBufferEvents: number;
}

export interface StreamingMetrics {
  failovers: number;
  avgLatency: number;
  originHealth: Record<string, number>;
}

export interface MetricPoint {
  time: string;
  value: number;
}

export interface PerformanceMetrics {
  dbLatency: MetricPoint[];
  apiLatency: MetricPoint[];
  errorRate: MetricPoint[];
}

export interface HotChannel {
  id: number;
  name: string;
  category: string;
  views: number;
  uniqueViewers: number;
}

export interface DashboardMetrics {
  overview: OverviewMetrics;
  streaming: StreamingMetrics;
  performance: PerformanceMetrics;
  hotChannels: HotChannel[];
}

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  duration_ms: number;
  services: Array<{
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    lastCheck: string;
    details?: Record<string, any>;
  }>;
  auto_heal_actions: Array<{
    type: string;
    target: string;
    executed: boolean;
    result?: string;
  }>;
  timestamp: string;
}

class ObservabilityService {
  private metricsCache: DashboardMetrics | null = null;
  private healthCache: SystemHealthStatus | null = null;
  private lastMetricsFetch = 0;
  private lastHealthFetch = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  async getMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<DashboardMetrics> {
    const now = Date.now();
    
    // Return cached if fresh
    if (this.metricsCache && now - this.lastMetricsFetch < this.CACHE_TTL) {
      return this.metricsCache;
    }

    try {
      const { data, error } = await supabase.functions.invoke('realtime-metrics', {
        body: { timeRange }
      });

      if (error) throw error;

      this.metricsCache = data;
      this.lastMetricsFetch = now;
      
      return data;
    } catch (error) {
      console.error('[Observability] Failed to fetch metrics:', error);
      
      // Return cached data if available
      if (this.metricsCache) return this.metricsCache;
      
      // Return empty metrics
      return {
        overview: {
          totalChannels: 0,
          healthyChannels: 0,
          activeUsers24h: 0,
          totalViews24h: 0,
          avgBufferEvents: 0
        },
        streaming: {
          failovers: 0,
          avgLatency: 0,
          originHealth: {}
        },
        performance: {
          dbLatency: [],
          apiLatency: [],
          errorRate: []
        },
        hotChannels: []
      };
    }
  }

  async getSystemHealth(): Promise<SystemHealthStatus> {
    const now = Date.now();
    
    if (this.healthCache && now - this.lastHealthFetch < this.CACHE_TTL) {
      return this.healthCache;
    }

    try {
      const { data, error } = await supabase.functions.invoke('system-health-check');

      if (error) throw error;

      this.healthCache = data;
      this.lastHealthFetch = now;
      
      return data;
    } catch (error) {
      console.error('[Observability] Failed to fetch health:', error);
      
      if (this.healthCache) return this.healthCache;
      
      return {
        status: 'unhealthy',
        duration_ms: 0,
        services: [],
        auto_heal_actions: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  async recordMetric(type: string, name: string, value: number, tags?: Record<string, any>): Promise<void> {
    try {
      // Persist to history table for realtime dashboard
      await supabase
        .from('observability_metrics_history')
        .insert({
          metric_type: type,
          metric_name: name,
          metric_value: value,
          tags: tags || {}
        });
    } catch (error) {
      console.warn('[Observability] Failed to record metric:', error);
    }
  }

  async getMetricsHistory(
    timeRange: '1h' | '24h' | '7d' = '24h',
    metricType?: string
  ): Promise<any[]> {
    const hoursMap = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = hoursMap[timeRange];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('observability_metrics_history')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(1000);

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Observability] Failed to fetch history:', error);
      return [];
    }

    return data || [];
  }

  async getHotChannels(limit: number = 10): Promise<HotChannel[]> {
    try {
      const { data, error } = await supabase
        .from('mv_hot_channels')
        .select('id, name, category, view_count, total_duration')
        .order('view_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((c: { id: number; name: string; category: string | null; view_count: number; total_duration: number }) => ({
        id: c.id,
        name: c.name,
        category: c.category || 'Unknown',
        views: c.view_count || 0,
        uniqueViewers: Math.floor((c.total_duration || 0) / 60) // Approximate from watch duration
      }));
    } catch (error) {
      console.error('[Observability] Failed to fetch hot channels:', error);
      return [];
    }
  }

  clearCache(): void {
    this.metricsCache = null;
    this.healthCache = null;
    this.lastMetricsFetch = 0;
    this.lastHealthFetch = 0;
  }
}

export const observabilityService = new ObservabilityService();
