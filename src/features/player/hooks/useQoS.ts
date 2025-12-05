/**
 * useQoS - Hook for QoS monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { qosService, SystemHealthSnapshot } from '../services/qosService';
import type { QoSMetrics, HealthStatus, StreamHealth } from '../types';

export function useQoS(autoRefresh = true, refreshInterval = 30000) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<QoSMetrics | null>(null);
  const [channelHealth, setChannelHealth] = useState<StreamHealth[]>([]);
  const [healthHistory, setHealthHistory] = useState<SystemHealthSnapshot[]>([]);
  const [cdnStats, setCdnStats] = useState<{
    hitRate: number;
    bandwidth: number;
    latency: number;
    errors: number;
  } | null>(null);
  const [activeStreams, setActiveStreams] = useState<{ count: number; bandwidth: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        healthData,
        historyData,
        channelData,
        cdnData,
        streamsData,
      ] = await Promise.all([
        qosService.getSystemHealth(),
        qosService.getHealthHistory(24),
        qosService.getChannelHealth(),
        qosService.getCDNStats(),
        qosService.getActiveStreamsStats(),
      ]);

      setHealth(healthData);
      setHealthHistory(historyData);
      setChannelHealth(channelData);
      setCdnStats(cdnData);
      setActiveStreams(streamsData);
      setMetrics(qosService.getAggregatedMetrics());
    } catch (err) {
      console.error('[useQoS] Error loading data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load QoS data'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadData, autoRefresh, refreshInterval]);

  const recordMetrics = useCallback((newMetrics: Partial<QoSMetrics>) => {
    qosService.recordMetrics(newMetrics);
    setMetrics(qosService.getAggregatedMetrics());
  }, []);

  return {
    health,
    metrics,
    channelHealth,
    healthHistory,
    cdnStats,
    activeStreams,
    isLoading,
    error,
    refresh: loadData,
    recordMetrics,
  };
}

export default useQoS;
