import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardMetrics, SystemHealthStatus } from '@/services/observabilityService';

interface MetricHistoryPoint {
  id: string;
  metric_type: string;
  metric_name: string;
  metric_value: number;
  tags: Record<string, any>;
  recorded_at: string;
}

interface UseRealtimeObservabilityOptions {
  enabled?: boolean;
  onNewMetric?: (metric: MetricHistoryPoint) => void;
}

export function useRealtimeObservability(options: UseRealtimeObservabilityOptions = {}) {
  const { enabled = true, onNewMetric } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeMetrics, setRealtimeMetrics] = useState<MetricHistoryPoint[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to realtime metrics
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('observability-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'observability_metrics_history'
        },
        (payload) => {
          const newMetric = payload.new as MetricHistoryPoint;
          console.log('[Realtime] New metric received:', newMetric.metric_name);
          
          setRealtimeMetrics(prev => {
            // Keep only last 100 metrics
            const updated = [newMetric, ...prev].slice(0, 100);
            return updated;
          });
          
          onNewMetric?.(newMetric);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          setConnectionError('Failed to connect to realtime channel');
        } else {
          setConnectionError(null);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Cleaning up subscription');
      channel.unsubscribe();
    };
  }, [enabled, onNewMetric]);

  // Fetch historical metrics
  const fetchHistory = useCallback(async (
    timeRange: '1h' | '24h' | '7d' = '24h',
    metricType?: string
  ) => {
    const hoursMap = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = hoursMap[timeRange];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('observability_metrics_history')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500);

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Realtime] Failed to fetch history:', error);
      return [];
    }

    return data as MetricHistoryPoint[];
  }, []);

  // Get aggregated metrics for charts
  const getAggregatedMetrics = useCallback((
    metrics: MetricHistoryPoint[],
    metricName: string,
    interval: 'minute' | 'hour' = 'minute'
  ) => {
    const filtered = metrics.filter(m => m.metric_name === metricName);
    const grouped: Record<string, number[]> = {};

    filtered.forEach(m => {
      const date = new Date(m.recorded_at);
      let key: string;
      
      if (interval === 'minute') {
        key = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else {
        key = `${date.getHours().toString().padStart(2, '0')}:00`;
      }

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m.metric_value);
    });

    return Object.entries(grouped).map(([time, values]) => ({
      time,
      value: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    })).sort((a, b) => a.time.localeCompare(b.time));
  }, []);

  // Clear metrics
  const clearRealtimeMetrics = useCallback(() => {
    setRealtimeMetrics([]);
  }, []);

  return {
    isConnected,
    connectionError,
    realtimeMetrics,
    fetchHistory,
    getAggregatedMetrics,
    clearRealtimeMetrics
  };
}
