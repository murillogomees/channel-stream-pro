/**
 * Route Health Checker
 * Async health checks for CDN endpoints with caching
 */

import type { 
  CdnEndpointType, 
  HealthCheckResult, 
  RouteHealthCache,
  LogHandler 
} from './types';

const STORAGE_KEY = 'stream_engine_route_health';
const DEFAULT_CHECK_TIMEOUT = 5000;
const DEFAULT_CACHE_DURATION = 60000; // 1 minute
const DEFAULT_FULL_CHECK_INTERVAL = 300000; // 5 minutes

export class RouteHealthChecker {
  private logHandler?: LogHandler;
  private checkTimeout: number;
  private cacheDuration: number;
  private fullCheckInterval: number;
  private memoryCache: RouteHealthCache;
  private checkInProgress: Map<CdnEndpointType, Promise<HealthCheckResult>>;
  
  // Endpoint URLs
  private endpoints: Record<CdnEndpointType, string>;

  constructor(options?: {
    logHandler?: LogHandler;
    checkTimeout?: number;
    cacheDuration?: number;
    fullCheckInterval?: number;
    proxyUrl?: string;
    r2Url?: string;
    cfStreamUrl?: string;
  }) {
    this.logHandler = options?.logHandler;
    this.checkTimeout = options?.checkTimeout ?? DEFAULT_CHECK_TIMEOUT;
    this.cacheDuration = options?.cacheDuration ?? DEFAULT_CACHE_DURATION;
    this.fullCheckInterval = options?.fullCheckInterval ?? DEFAULT_FULL_CHECK_INTERVAL;
    this.checkInProgress = new Map();

    // Configure endpoint URLs
    this.endpoints = {
      proxy: options?.proxyUrl ?? 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/stream-proxy',
      r2: options?.r2Url ?? 'https://pub-iptvlink.r2.dev',
      'cf-stream': options?.cfStreamUrl ?? 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/cf-stream-playback',
      origin: '', // Origin is tested per-request
    };

    // Initialize cache
    this.memoryCache = this.loadFromStorage();
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    this.logHandler?.({
      level,
      module: 'RouteHealthChecker',
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Load cached health data from localStorage
   */
  private loadFromStorage(): RouteHealthCache {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const resultsMap = new Map<CdnEndpointType, HealthCheckResult>();
        Object.entries(data.results || {}).forEach(([key, value]) => {
          resultsMap.set(key as CdnEndpointType, value as HealthCheckResult);
        });
        return {
          results: resultsMap,
          lastFullCheck: data.lastFullCheck || 0,
          preferredRoute: data.preferredRoute,
        };
      }
    } catch (error) {
      this.log('warn', 'Failed to load health cache from storage', { error: String(error) });
    }
    return {
      results: new Map(),
      lastFullCheck: 0,
    };
  }

  /**
   * Save health data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        results: Object.fromEntries(this.memoryCache.results),
        lastFullCheck: this.memoryCache.lastFullCheck,
        preferredRoute: this.memoryCache.preferredRoute,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      this.log('warn', 'Failed to save health cache to storage', { error: String(error) });
    }
  }

  /**
   * Check health of a single endpoint
   */
  async checkEndpoint(endpoint: CdnEndpointType, testUrl?: string): Promise<HealthCheckResult> {
    // Check if there's already a check in progress
    const existing = this.checkInProgress.get(endpoint);
    if (existing) {
      return existing;
    }

    // Check cache first
    const cached = this.memoryCache.results.get(endpoint);
    if (cached && (Date.now() - cached.checkedAt) < this.cacheDuration) {
      this.log('debug', 'Using cached health result', { endpoint, healthy: cached.healthy });
      return cached;
    }

    // Perform health check
    const checkPromise = this.performHealthCheck(endpoint, testUrl);
    this.checkInProgress.set(endpoint, checkPromise);

    try {
      const result = await checkPromise;
      this.memoryCache.results.set(endpoint, result);
      this.saveToStorage();
      return result;
    } finally {
      this.checkInProgress.delete(endpoint);
    }
  }

  /**
   * Perform actual health check
   */
  private async performHealthCheck(endpoint: CdnEndpointType, testUrl?: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let url = testUrl || this.endpoints[endpoint];

    // Skip if no URL configured
    if (!url && endpoint !== 'origin') {
      return {
        endpoint,
        healthy: false,
        latencyMs: 0,
        error: 'No endpoint URL configured',
        checkedAt: Date.now(),
      };
    }

    // For origin, we need a test URL
    if (endpoint === 'origin' && !testUrl) {
      return {
        endpoint,
        healthy: true, // Assume origin is available
        latencyMs: 0,
        checkedAt: Date.now(),
      };
    }

    // Build health check URL
    let healthUrl = url;
    switch (endpoint) {
      case 'proxy':
        healthUrl = `${url}?health=1`;
        break;
      case 'r2':
        // Try to fetch a known small file or just check connectivity
        healthUrl = url;
        break;
      case 'cf-stream':
        healthUrl = `${url}?health=1`;
        break;
      case 'origin':
        healthUrl = testUrl || url;
        break;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.checkTimeout);

      const response = await fetch(healthUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      // For R2, a 403/404 on the base URL is expected, we just need connectivity
      const healthy = endpoint === 'r2' 
        ? response.status !== 0 
        : response.ok || response.status === 200 || response.status === 204;

      this.log('info', 'Health check completed', { 
        endpoint, 
        healthy, 
        latencyMs,
        status: response.status 
      });

      return {
        endpoint,
        healthy,
        latencyMs,
        statusCode: response.status,
        checkedAt: Date.now(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.log('warn', 'Health check failed', { endpoint, error: String(error), latencyMs });

      return {
        endpoint,
        healthy: false,
        latencyMs,
        error: String(error),
        checkedAt: Date.now(),
      };
    }
  }

  /**
   * Check all endpoints and determine best route
   */
  async checkAllEndpoints(originTestUrl?: string): Promise<RouteHealthCache> {
    this.log('info', 'Running full health check');

    const endpoints: CdnEndpointType[] = ['proxy', 'r2', 'cf-stream'];
    if (originTestUrl) {
      endpoints.push('origin');
    }

    const results = await Promise.all(
      endpoints.map(endpoint => 
        this.checkEndpoint(endpoint, endpoint === 'origin' ? originTestUrl : undefined)
      )
    );

    // Update cache
    results.forEach(result => {
      this.memoryCache.results.set(result.endpoint, result);
    });
    this.memoryCache.lastFullCheck = Date.now();

    // Determine preferred route (lowest latency among healthy)
    const healthyResults = results.filter(r => r.healthy).sort((a, b) => a.latencyMs - b.latencyMs);
    if (healthyResults.length > 0) {
      this.memoryCache.preferredRoute = healthyResults[0].endpoint;
    }

    this.saveToStorage();

    this.log('info', 'Full health check completed', {
      preferredRoute: this.memoryCache.preferredRoute,
      healthyCount: healthyResults.length,
    });

    return this.memoryCache;
  }

  /**
   * Get current health status (from cache)
   */
  getHealthStatus(): RouteHealthCache {
    return this.memoryCache;
  }

  /**
   * Get preferred route based on health
   */
  getPreferredRoute(): CdnEndpointType {
    return this.memoryCache.preferredRoute || 'proxy';
  }

  /**
   * Check if an endpoint is healthy (uses cache)
   */
  isHealthy(endpoint: CdnEndpointType): boolean {
    const result = this.memoryCache.results.get(endpoint);
    if (!result) return false;
    if ((Date.now() - result.checkedAt) > this.cacheDuration) return false;
    return result.healthy;
  }

  /**
   * Get latency for an endpoint (from cache)
   */
  getLatency(endpoint: CdnEndpointType): number | undefined {
    return this.memoryCache.results.get(endpoint)?.latencyMs;
  }

  /**
   * Clear all cached health data
   */
  clearCache(): void {
    this.memoryCache = {
      results: new Map(),
      lastFullCheck: 0,
    };
    localStorage.removeItem(STORAGE_KEY);
    this.log('info', 'Health cache cleared');
  }

  /**
   * Check if full health check is needed
   */
  needsFullCheck(): boolean {
    return (Date.now() - this.memoryCache.lastFullCheck) > this.fullCheckInterval;
  }
}

// Singleton instance
let healthCheckerInstance: RouteHealthChecker | null = null;

export function getRouteHealthChecker(options?: {
  logHandler?: LogHandler;
}): RouteHealthChecker {
  if (!healthCheckerInstance) {
    healthCheckerInstance = new RouteHealthChecker(options);
  }
  return healthCheckerInstance;
}

/**
 * Quick health check for a single endpoint
 */
export async function checkEndpointHealth(endpoint: CdnEndpointType): Promise<HealthCheckResult> {
  return getRouteHealthChecker().checkEndpoint(endpoint);
}

/**
 * Get preferred route based on health
 */
export function getPreferredRoute(): CdnEndpointType {
  return getRouteHealthChecker().getPreferredRoute();
}
