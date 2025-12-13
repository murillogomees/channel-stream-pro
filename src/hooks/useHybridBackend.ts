/**
 * Hook for Backend Operations - Self-Hosted Only
 * Provides React-friendly interface for calling Edge Functions
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  callHybridFunction, 
  getHealthStatus, 
  checkBackendHealth,
  getBackendStats,
  initHybridBackend,
} from '@/services/hybridBackendService';

interface UseHybridFunctionOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface UseHybridFunctionResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  backend: string | null;
  call: (body?: Record<string, unknown>) => Promise<void>;
}

/**
 * Hook for calling Edge Functions
 */
export function useHybridFunction<T = unknown>(
  functionName: string,
  options?: UseHybridFunctionOptions
): UseHybridFunctionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [backend, setBackend] = useState<string | null>(null);

  const call = useCallback(async (body?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await callHybridFunction<T>(functionName, body);
      
      setData(result.data);
      setBackend(result.backend);
      
      if (result.error) {
        setError(result.error);
        options?.onError?.(result.error);
      } else {
        options?.onSuccess?.(result.data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [functionName, options]);

  return { data, error, loading, backend, call };
}

/**
 * Hook for backend health monitoring
 */
export function useBackendHealth() {
  const [health, setHealth] = useState(getHealthStatus());
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    const newHealth = await checkBackendHealth();
    setHealth(newHealth);
    setChecking(false);
  }, []);

  useEffect(() => {
    // Initial check
    refresh();
    
    // Update periodically
    const interval = setInterval(() => {
      setHealth(getHealthStatus());
    }, 30000); // Update UI every 30s
    
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    health,
    checking,
    refresh,
    isSelfHostedConfigured: true, // Always true - only self-hosted
    stats: getBackendStats(),
  };
}

/**
 * Hook for backend initialization
 */
export function useHybridBackendInit() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    initHybridBackend()
      .then(() => setInitialized(true))
      .catch((err) => setError(err));
  }, []);

  return { initialized, error };
}

/**
 * Hook to check operation routing (always self-hosted)
 */
export function useOperationRouting(_functionName: string) {
  const health = getHealthStatus();
  
  return {
    isHeavy: true,
    selfHostedConfigured: true,
    selfHostedHealthy: health.healthy,
    willUseSelfHosted: true,
    currentBackend: 'selfhosted',
  };
}
