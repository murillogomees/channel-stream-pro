/**
 * Backend Service
 * Todas as operações vão para o Self-Hosted (único backend)
 */

import { supabase, supabaseConfig, getFunctionUrl } from "@/integrations/supabase/client";

// Operation categories (mantido para compatibilidade)
type OperationType = 
  | 'heavy-m3u'      // M3U processing, sync, generation
  | 'heavy-stream'   // Stream proxy, transcoding
  | 'heavy-cdn'      // CDN operations, bulk downloads
  | 'light-auth'     // Authentication
  | 'light-payment'  // MercadoPago operations
  | 'light-notify'   // WhatsApp notifications
  | 'light-db'       // Simple database queries
  | 'auto';          // Auto-detect based on function name

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
 * Todas as operações vão para self-hosted (único backend)
 */
export const isHeavyOperation = (_functionName: string): boolean => true;

/**
 * Sempre retorna 'selfhosted' (único backend)
 */
export const getBackendForOperation = (
  _functionName: string,
  _forceBackend?: 'cloud' | 'selfhosted'
): 'selfhosted' => 'selfhosted';

/**
 * Call Edge Function 
 */
export const callHybridFunction = async <T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
  _options?: {
    forceBackend?: 'cloud' | 'selfhosted';
    timeout?: number;
  }
): Promise<{ data: T | null; error: Error | null; backend: string }> => {
  const startTime = performance.now();
  
  console.log(`[Backend] Calling ${functionName}`);
  
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
export const checkBackendHealth = async (): Promise<{ selfHosted: BackendHealth; cloud: BackendHealth }> => {
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
  return { selfHosted: healthStatus, cloud: healthStatus };
};

/**
 * Get current health status
 */
export const getHealthStatus = () => {
  if (Date.now() - healthStatus.lastCheck > HEALTH_CHECK_INTERVAL) {
    checkBackendHealth();
  }
  return { selfHosted: healthStatus, cloud: healthStatus };
};

/**
 * Get backend URL
 */
export const getBackendUrl = (_backend?: 'cloud' | 'selfhosted'): string => {
  return supabaseConfig.url;
};

/**
 * Initialize backend
 */
export const initHybridBackend = async (): Promise<void> => {
  console.log('[Backend] Initializing...');
  console.log('[Backend] URL:', supabaseConfig.url);
  
  await checkBackendHealth();
  setInterval(checkBackendHealth, HEALTH_CHECK_INTERVAL);
};

// Statistics for monitoring
interface BackendStats {
  cloudCalls: number;
  selfHostedCalls: number;
  fallbacks: number;
  avgCloudLatency: number;
  avgSelfHostedLatency: number;
}

let stats: BackendStats = {
  cloudCalls: 0,
  selfHostedCalls: 0,
  fallbacks: 0,
  avgCloudLatency: 0,
  avgSelfHostedLatency: 0,
};

export const getBackendStats = (): BackendStats => stats;

export const resetBackendStats = (): void => {
  stats = {
    cloudCalls: 0,
    selfHostedCalls: 0,
    fallbacks: 0,
    avgCloudLatency: 0,
    avgSelfHostedLatency: 0,
  };
};

// Compatibilidade legada
export const isSelfHostedConfigured = (): boolean => true;
export const SELF_HOSTED_BASE_URL = supabaseConfig.url;
