/**
 * Backend Service - Self-Hosted Only
 * 
 * Todas as operações vão exclusivamente para o Supabase Self-Hosted.
 * URL: https://supabase.iptvlink.com.br
 */

import { supabase, supabaseConfig, getFunctionUrl } from "@/integrations/supabase/client";

// Track backend health status
interface BackendHealth {
  healthy: boolean;
  lastCheck: number;
  latency: number;
}

let healthStatus: BackendHealth = {
  healthy: true,
  lastCheck: 0,
  latency: 0,
};

// Health check interval (5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * Call Edge Function on Self-Hosted
 */
export const callHybridFunction = async <T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
  _options?: {
    timeout?: number;
  }
): Promise<{ data: T | null; error: Error | null; backend: string }> => {
  const startTime = performance.now();
  
  console.log(`[Backend] Calling ${functionName} on self-hosted`);
  
  try {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
    });
    
    healthStatus = {
      healthy: !error,
      lastCheck: Date.now(),
      latency: performance.now() - startTime,
    };
    
    return { 
      data, 
      error: error ? new Error(error.message) : null, 
      backend: 'selfhosted' 
    };
    
  } catch (err) {
    console.error(`[Backend] Error calling ${functionName}:`, err);
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error(String(err)),
      backend: 'selfhosted',
    };
  }
};

/**
 * Health check
 */
export const checkBackendHealth = async (): Promise<BackendHealth> => {
  const now = Date.now();
  
  try {
    const start = performance.now();
    const { error } = await supabase.from('health_checks').select('id').limit(1);
    healthStatus = {
      healthy: !error,
      lastCheck: now,
      latency: performance.now() - start,
    };
  } catch {
    healthStatus = { healthy: false, lastCheck: now, latency: 0 };
  }
  
  console.log('[Backend] Health check:', healthStatus);
  return healthStatus;
};

/**
 * Get current health status
 */
export const getHealthStatus = () => {
  if (Date.now() - healthStatus.lastCheck > HEALTH_CHECK_INTERVAL) {
    checkBackendHealth();
  }
  return healthStatus;
};

/**
 * Get backend URL
 */
export const getBackendUrl = (): string => {
  return supabaseConfig.url;
};

/**
 * Initialize backend
 */
export const initHybridBackend = async (): Promise<void> => {
  console.log('[Backend] Initializing Self-Hosted...');
  console.log('[Backend] URL:', supabaseConfig.url);
  
  await checkBackendHealth();
  setInterval(checkBackendHealth, HEALTH_CHECK_INTERVAL);
};

// Statistics for monitoring
interface BackendStats {
  calls: number;
  avgLatency: number;
}

let stats: BackendStats = {
  calls: 0,
  avgLatency: 0,
};

export const getBackendStats = (): BackendStats => stats;

export const resetBackendStats = (): void => {
  stats = { calls: 0, avgLatency: 0 };
};

// Backward compatibility
export const isSelfHostedConfigured = (): boolean => true;
export const SELF_HOSTED_BASE_URL = supabaseConfig.url;
