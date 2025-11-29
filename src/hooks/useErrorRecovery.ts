/**
 * ============================================================================
 * useErrorRecovery - Error Recovery Hook
 * ============================================================================
 * 
 * Hook para gerenciar recuperação de erros de streaming.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  errorRecoveryService, 
  RecoveryStats, 
  RecoveryConfig,
  StreamError,
  RecoveryAction,
} from '@/services/errorRecoveryService';

interface UseErrorRecoveryOptions {
  config?: Partial<RecoveryConfig>;
  onRecoveryStart?: (error: StreamError, action: RecoveryAction) => void;
  onRecoverySuccess?: (error: StreamError, action: RecoveryAction) => void;
  onRecoveryFailed?: (error: StreamError, action: RecoveryAction) => void;
  onFatalError?: (error: StreamError) => void;
}

export function useErrorRecovery(options: UseErrorRecoveryOptions = {}) {
  const { config, onRecoveryStart, onRecoverySuccess, onRecoveryFailed, onFatalError } = options;

  const [isRecovering, setIsRecovering] = useState(false);
  const [lastError, setLastError] = useState<StreamError | null>(null);
  const [stats, setStats] = useState<RecoveryStats | null>(null);
  const [recoveryRate, setRecoveryRate] = useState(100);

  const hlsRef = useRef<Hls | null>(null);

  // Attach to HLS instance
  const attach = useCallback((hls: Hls) => {
    hlsRef.current = hls;

    errorRecoveryService.attach(hls, config, {
      onRecoveryStart: (error, action) => {
        setIsRecovering(true);
        setLastError(error);
        onRecoveryStart?.(error, action);
      },
      onRecoverySuccess: (error, action) => {
        setIsRecovering(false);
        setStats(errorRecoveryService.getStats());
        setRecoveryRate(errorRecoveryService.getRecoveryRate());
        onRecoverySuccess?.(error, action);
      },
      onRecoveryFailed: (error, action) => {
        setStats(errorRecoveryService.getStats());
        onRecoveryFailed?.(error, action);
      },
      onFatalError: (error) => {
        setIsRecovering(false);
        setLastError(error);
        setStats(errorRecoveryService.getStats());
        setRecoveryRate(errorRecoveryService.getRecoveryRate());
        onFatalError?.(error);
      },
    });

    return () => {
      errorRecoveryService.detach();
    };
  }, [config, onRecoveryStart, onRecoverySuccess, onRecoveryFailed, onFatalError]);

  // Get current stats
  const getStats = useCallback(() => {
    return errorRecoveryService.getStats();
  }, []);

  // Get recovery history
  const getHistory = useCallback(() => {
    return errorRecoveryService.getHistory();
  }, []);

  // Reset stats
  const resetStats = useCallback(() => {
    errorRecoveryService.resetStats();
    setStats(null);
    setRecoveryRate(100);
    setLastError(null);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      errorRecoveryService.detach();
    };
  }, []);

  return {
    // State
    isRecovering,
    lastError,
    stats,
    recoveryRate,

    // Actions
    attach,
    getStats,
    getHistory,
    resetStats,
  };
}

export default useErrorRecovery;
