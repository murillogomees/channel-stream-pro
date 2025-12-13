/**
 * Hook for Supabase operations
 * 
 * Simplified wrapper for Cloud Supabase
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseConfig, getFunctionUrl } from '@/integrations/supabase/client';
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
    url: supabaseConfig.url,
    lastChecked: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        setConnectionStatus({
          connected: false,
          url: supabaseConfig.url,
          lastChecked: new Date(),
          error: error.message,
        });
        return false;
      }

      setConnectionStatus({
        connected: true,
        url: supabaseConfig.url,
        lastChecked: new Date(),
      });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      setConnectionStatus({
        connected: false,
        url: supabaseConfig.url,
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
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    
    if (error) {
      toast.error(`Function ${functionName} failed: ${error.message}`);
      return null;
    }
    
    return data as T;
  }, []);

  return {
    client: supabase,
    config: supabaseConfig,
    connectionStatus,
    isLoading,
    testConnection,
    invokeFunction,
  };
}

export default useSelfHostedSupabase;
