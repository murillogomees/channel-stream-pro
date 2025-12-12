/**
 * Hybrid Backend Service
 * Intelligently routes operations between Lovable Cloud and Self-Hosted VPS
 * 
 * ROUTING LOGIC:
 * - Heavy operations (M3U, streaming) → Self-Hosted VPS (32GB RAM)
 * - Light operations (auth, payments) → Lovable Cloud
 * - Auto-fallback if self-hosted is unavailable
 */

import { supabase } from "@/integrations/supabase/client";
import { 
  getSelfHostedClient, 
  callSelfHostedFunction, 
  isSelfHostedConfigured,
  SELF_HOSTED_BASE_URL 
} from "@/integrations/supabase/selfHostedClient";

// Operation categories
type OperationType = 
  | 'heavy-m3u'      // M3U processing, sync, generation
  | 'heavy-stream'   // Stream proxy, transcoding
  | 'heavy-cdn'      // CDN operations, bulk downloads
  | 'light-auth'     // Authentication
  | 'light-payment'  // MercadoPago operations
  | 'light-notify'   // WhatsApp notifications
  | 'light-db'       // Simple database queries
  | 'auto';          // Auto-detect based on function name

// Heavy functions that should route to self-hosted
const HEAVY_FUNCTIONS = new Set([
  'fetch-m3u',
  'fetch-m3u-url',
  'm3u-sync',
  'm3u-cron-sync',
  'm3u-ingest',
  'm3u-playlist',
  'generate-m3u-from-sync',
  'generate-m3u-file',
  'process-m3u-import',
  'clean-m3u',
  'm3u-clean-advanced',
  'clean-sync-entries',
  'stream-proxy',
  'stream-url-resolve',
  'transcode-processor',
  'transcode-webhook',
  'cdn-bulk-downloader',
  'cdn-content-downloader',
  'cdn-prewarm',
  'r2-upload',
  'r2-migration-worker',
  'r2-upload-proxy',
  'iptv-m3u-generator',
  'playlist-cdn-generate',
]);

// Track backend health status
interface BackendHealth {
  cloud: { healthy: boolean; lastCheck: number; latency: number };
  selfHosted: { healthy: boolean; lastCheck: number; latency: number };
}

let healthStatus: BackendHealth = {
  cloud: { healthy: true, lastCheck: 0, latency: 0 },
  selfHosted: { healthy: false, lastCheck: 0, latency: 0 },
};

// Health check interval (5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * Check if an operation is heavy (should go to self-hosted)
 */
export const isHeavyOperation = (functionName: string): boolean => {
  return HEAVY_FUNCTIONS.has(functionName);
};

/**
 * Determine which backend to use
 */
export const getBackendForOperation = (
  functionName: string,
  forceBackend?: 'cloud' | 'selfhosted'
): 'cloud' | 'selfhosted' => {
  // If forced, respect it
  if (forceBackend) return forceBackend;
  
  // If self-hosted not configured, always use cloud
  if (!isSelfHostedConfigured()) return 'cloud';
  
  // If self-hosted is unhealthy, fallback to cloud
  if (!healthStatus.selfHosted.healthy) return 'cloud';
  
  // Route heavy operations to self-hosted
  if (isHeavyOperation(functionName)) return 'selfhosted';
  
  // Default to cloud for light operations
  return 'cloud';
};

/**
 * Call Edge Function with intelligent routing
 */
export const callHybridFunction = async <T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
  options?: {
    forceBackend?: 'cloud' | 'selfhosted';
    timeout?: number;
  }
): Promise<{ data: T | null; error: Error | null; backend: string }> => {
  const backend = getBackendForOperation(functionName, options?.forceBackend);
  const startTime = performance.now();
  
  console.log(`[HybridBackend] Routing ${functionName} to ${backend}`);
  
  try {
    if (backend === 'selfhosted') {
      const result = await callSelfHostedFunction<T>(functionName, body);
      
      // Update health status on success
      healthStatus.selfHosted = {
        healthy: !result.error,
        lastCheck: Date.now(),
        latency: performance.now() - startTime,
      };
      
      // If self-hosted failed, fallback to cloud
      if (result.error && !options?.forceBackend) {
        console.warn(`[HybridBackend] Self-hosted failed, falling back to cloud`);
        return callHybridFunction(functionName, body, { ...options, forceBackend: 'cloud' });
      }
      
      return { ...result, backend: 'selfhosted' };
    }
    
    // Cloud backend (Lovable)
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
    });
    
    healthStatus.cloud = {
      healthy: !error,
      lastCheck: Date.now(),
      latency: performance.now() - startTime,
    };
    
    return { 
      data, 
      error: error ? new Error(error.message) : null, 
      backend: 'cloud' 
    };
    
  } catch (err) {
    console.error(`[HybridBackend] Error calling ${functionName}:`, err);
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error(String(err)),
      backend,
    };
  }
};

/**
 * Health check for both backends
 */
export const checkBackendHealth = async (): Promise<BackendHealth> => {
  const now = Date.now();
  
  // Check cloud health
  try {
    const startCloud = performance.now();
    const { error } = await supabase.from('health_checks').select('id').limit(1);
    healthStatus.cloud = {
      healthy: !error,
      lastCheck: now,
      latency: performance.now() - startCloud,
    };
  } catch {
    healthStatus.cloud = { healthy: false, lastCheck: now, latency: 0 };
  }
  
  // Check self-hosted health
  if (isSelfHostedConfigured()) {
    try {
      const startSelfHosted = performance.now();
      const response = await fetch(`${SELF_HOSTED_BASE_URL}/rest/v1/health_checks?limit=1`, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_SELFHOSTED_KEY || '' },
      });
      healthStatus.selfHosted = {
        healthy: response.ok,
        lastCheck: now,
        latency: performance.now() - startSelfHosted,
      };
    } catch {
      healthStatus.selfHosted = { healthy: false, lastCheck: now, latency: 0 };
    }
  }
  
  console.log('[HybridBackend] Health check:', healthStatus);
  return healthStatus;
};

/**
 * Get current health status
 */
export const getHealthStatus = (): BackendHealth => {
  // Trigger health check if stale
  if (Date.now() - healthStatus.cloud.lastCheck > HEALTH_CHECK_INTERVAL) {
    checkBackendHealth();
  }
  return healthStatus;
};

/**
 * Get backend URL for direct calls
 */
export const getBackendUrl = (backend: 'cloud' | 'selfhosted'): string => {
  if (backend === 'selfhosted') {
    return SELF_HOSTED_BASE_URL;
  }
  return import.meta.env.VITE_SUPABASE_URL || 'https://waxgowafohlrfoefwhsf.supabase.co';
};

/**
 * Initialize hybrid backend (call on app start)
 */
export const initHybridBackend = async (): Promise<void> => {
  console.log('[HybridBackend] Initializing...');
  console.log('[HybridBackend] Self-hosted configured:', isSelfHostedConfigured());
  
  await checkBackendHealth();
  
  // Schedule periodic health checks
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
