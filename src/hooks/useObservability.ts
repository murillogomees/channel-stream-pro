import { useState, useEffect, useCallback } from 'react';
import { observabilityService, DashboardMetrics, SystemHealthStatus } from '@/services/observabilityService';

interface UseObservabilityOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
  timeRange?: '1h' | '24h' | '7d';
}

export function useObservability(options: UseObservabilityOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 30000,
    timeRange = '24h'
  } = options;

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [metricsData, healthData] = await Promise.all([
        observabilityService.getMetrics(timeRange),
        observabilityService.getSystemHealth()
      ]);
      
      setMetrics(metricsData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  const refresh = useCallback(() => {
    observabilityService.clearCache();
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  const getStatusColor = useCallback((status: 'healthy' | 'degraded' | 'unhealthy'): string => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  }, []);

  const getStatusBg = useCallback((status: 'healthy' | 'degraded' | 'unhealthy'): string => {
    switch (status) {
      case 'healthy': return 'bg-green-500/10';
      case 'degraded': return 'bg-yellow-500/10';
      case 'unhealthy': return 'bg-red-500/10';
      default: return 'bg-muted';
    }
  }, []);

  return {
    metrics,
    health,
    isLoading,
    error,
    refresh,
    getStatusColor,
    getStatusBg
  };
}
