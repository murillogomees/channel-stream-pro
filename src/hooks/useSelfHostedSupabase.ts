/**
 * Hook for Self-Hosted Supabase operations
 * 
 * Use this hook instead of direct supabase imports for self-hosted operations
 */

import { useState, useCallback } from 'react';
import { selfHostedSupabase, selfHostedConfig, invokeSelfHostedFunction } from '@/integrations/selfhosted';
import { toast } from 'sonner';

export interface SelfHostedConnectionStatus {
  connected: boolean;
  url: string;
  lastChecked: Date | null;
  error?: string;
}

export function useSelfHostedSupabase() {
  const [connectionStatus, setConnectionStatus] = useState<SelfHostedConnectionStatus>({
    connected: false,
    url: selfHostedConfig.url,
    lastChecked: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simple query to test connection
      const { error } = await selfHostedSupabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        setConnectionStatus({
          connected: false,
          url: selfHostedConfig.url,
          lastChecked: new Date(),
          error: error.message,
        });
        return false;
      }

      setConnectionStatus({
        connected: true,
        url: selfHostedConfig.url,
        lastChecked: new Date(),
      });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      setConnectionStatus({
        connected: false,
        url: selfHostedConfig.url,
        lastChecked: new Date(),
        error: errorMsg,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const invokeFunction = useCallback(async <T>(
    functionName: string,
    body?: Record<string, unknown>
  ): Promise<T | null> => {
    const { data, error } = await invokeSelfHostedFunction<T>(functionName, { body });
    
    if (error) {
      toast.error(`Function ${functionName} failed: ${error.message}`);
      return null;
    }
    
    return data;
  }, []);

  return {
    client: selfHostedSupabase,
    config: selfHostedConfig,
    connectionStatus,
    isLoading,
    testConnection,
    invokeFunction,
  };
}

export default useSelfHostedSupabase;
