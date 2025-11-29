/**
 * ============================================================================
 * useConnectionAware - Connection Quality Hook
 * ============================================================================
 * 
 * Hook para monitorar qualidade da conexão e ajustar streaming.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  connectionService, 
  ConnectionInfo, 
  ConnectionQuality,
} from '@/services/connectionService';

interface UseConnectionAwareOptions {
  enableMonitoring?: boolean;
  monitoringInterval?: number;
}

export function useConnectionAware(options: UseConnectionAwareOptions = {}) {
  const { 
    enableMonitoring = false, 
    monitoringInterval = 30000,
  } = options;

  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Subscribe to connection changes
  useEffect(() => {
    const unsubscribe = connectionService.subscribe((info) => {
      setConnectionInfo(info);
    });

    // Online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start monitoring if enabled
    if (enableMonitoring) {
      connectionService.startMonitoring(monitoringInterval);
    }

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connectionService.stopMonitoring();
    };
  }, [enableMonitoring, monitoringInterval]);

  // Manual measurement
  const measureConnection = useCallback(async () => {
    const info = await connectionService.measureConnection();
    setConnectionInfo(info);
    return info;
  }, []);

  // Record download speed
  const recordSpeed = useCallback((bytesLoaded: number, durationMs: number) => {
    connectionService.recordDownloadSpeed(bytesLoaded, durationMs);
  }, []);

  // Get HLS config for current connection
  const getHlsConfig = useCallback(() => {
    return connectionService.getHlsConfig();
  }, []);

  // Quality indicator
  const getQualityIndicator = useCallback((quality: ConnectionQuality): { 
    icon: string; 
    color: string; 
    label: string;
  } => {
    switch (quality) {
      case 'excellent':
        return { icon: '📶', color: 'text-green-500', label: 'Excelente' };
      case 'good':
        return { icon: '📶', color: 'text-blue-500', label: 'Boa' };
      case 'fair':
        return { icon: '📶', color: 'text-yellow-500', label: 'Regular' };
      case 'poor':
        return { icon: '📶', color: 'text-red-500', label: 'Fraca' };
    }
  }, []);

  return {
    // State
    connectionInfo,
    isOnline,
    quality: connectionInfo?.quality ?? 'unknown',
    downlink: connectionInfo?.downlink ?? 0,
    rtt: connectionInfo?.rtt ?? 0,
    saveData: connectionInfo?.saveData ?? false,
    suggestedMaxBitrate: connectionInfo?.suggestedMaxBitrate ?? 0,
    
    // Actions
    measureConnection,
    recordSpeed,
    getHlsConfig,
    getQualityIndicator,
  };
}

export default useConnectionAware;
