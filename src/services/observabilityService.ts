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

// Materialized view summary types
export interface DashboardSummary {
  total_users: number;
  active_users: number;
  trial_users: number;
  expired_users: number;
  expiring_soon: number;
  total_channels: number;
  healthy_channels: number;
  total_categories: number;
  total_series: number;
  approved_payments: number;
  monthly_revenue: number;
  last_refresh: string | null;
}

export interface ChannelHealthStats {
  category: string;
  channel_count: number;
  healthy_count: number;
  unhealthy_count: number;
  avg_health_score: number;
  series_count: number;
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
  private summaryCache: DashboardSummary | null = null;
  private lastMetricsFetch = 0;
  private lastHealthFetch = 0;
  private lastSummaryFetch = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Get dashboard summary from materialized view (optimized)
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const now = Date.now();
    
    if (this.summaryCache && now - this.lastSummaryFetch < this.CACHE_TTL) {
      return this.summaryCache;
    }

    try {
      // Use the optimized database function
      const { data, error } = await supabase.rpc('get_dashboard_summary');

      if (error) throw error;

      const summary = data?.[0] || {
        total_users: 0,
        active_users: 0,
        trial_users: 0,
        expired_users: 0,
        expiring_soon: 0,
        total_channels: 0,
        healthy_channels: 0,
        total_categories: 0,
        total_series: 0,
        approved_payments: 0,
        monthly_revenue: 0,
        last_refresh: null
      };

      this.summaryCache = summary;
      this.lastSummaryFetch = now;
      
      return summary;
    } catch (error) {
      console.error('[Observability] Failed to fetch dashboard summary:', error);
      return this.summaryCache || {
        total_users: 0,
        active_users: 0,
        trial_users: 0,
        expired_users: 0,
        expiring_soon: 0,
        total_channels: 0,
        healthy_channels: 0,
        total_categories: 0,
        total_series: 0,
        approved_payments: 0,
        monthly_revenue: 0,
        last_refresh: null
      };
    }
  }

  /**
   * Get channel stats by category from materialized view
   */
  async getChannelStatsByCategory(): Promise<ChannelHealthStats[]> {
    try {
      const { data, error } = await supabase.rpc('get_channel_stats_by_category');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Observability] Failed to fetch channel stats:', error);
      return [];
    }
  }

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

  /**
   * Get hot channels from materialized view (optimized)
   */
  async getHotChannels(limit: number = 10): Promise<HotChannel[]> {
    try {
      // Use the optimized database function
      const { data, error } = await supabase.rpc('get_hot_channels', { p_limit: limit });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        category: c.category || 'Unknown',
        views: Number(c.view_count) || 0,
        uniqueViewers: Math.floor((Number(c.total_duration) || 0) / 60)
      }));
    } catch (error) {
      console.error('[Observability] Failed to fetch hot channels:', error);
      return [];
    }
  }

  /**
   * Get recent activities using optimized function
   */
  async getRecentActivities(userId?: string, limit: number = 50, days: number = 7): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_recent_activities', {
        p_user_id: userId || null,
        p_limit: limit,
        p_days: days
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Observability] Failed to fetch activities:', error);
      return [];
    }
  }

  /**
   * Manually trigger materialized views refresh
   */
  async refreshMaterializedViews(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('refresh_all_materialized_views');
      if (error) throw error;
      
      // Clear local cache
      this.clearCache();
      return true;
    } catch (error) {
      console.error('[Observability] Failed to refresh materialized views:', error);
      return false;
    }
  }

  clearCache(): void {
    this.metricsCache = null;
    this.healthCache = null;
    this.summaryCache = null;
    this.lastMetricsFetch = 0;
    this.lastHealthFetch = 0;
    this.lastSummaryFetch = 0;
  }
}

export const observabilityService = new ObservabilityService();