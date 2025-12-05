/**
 * CDN Router
 * Enterprise-grade content routing with health-aware failover
 * 
 * Priority Order:
 * 1. Proxy (stream-proxy) - Always available, handles auth
 * 2. R2 (if content exists) - Fast CDN delivery
 * 3. Cloudflare Stream (if transcoded) - Adaptive streaming
 * 4. Origin (raw HTTP) - Fallback via proxy for mixed content
 */

import type { 
  CdnEndpoint, 
  CdnEndpointType, 
  CdnRouterConfig,
  RouteDecision, 
  FailoverPath,
  LogHandler,
  ProtocolType
} from './types';
import { getRouteHealthChecker, RouteHealthChecker } from './route-health';

const DEFAULT_CONFIG: CdnRouterConfig = {
  proxyBaseUrl: 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/stream-proxy',
  r2BaseUrl: 'https://pub-iptvlink.r2.dev',
  cfStreamBaseUrl: 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/cf-stream-playback',
  healthCheckTimeout: 5000,
  cacheDecisionMs: 60000,
  maxRetries: 3,
};

export class CdnRouter {
  private config: CdnRouterConfig;
  private logHandler?: LogHandler;
  private healthChecker: RouteHealthChecker;
  private routeDecisionCache: Map<string, RouteDecision>;

  constructor(options?: {
    config?: Partial<CdnRouterConfig>;
    logHandler?: LogHandler;
  }) {
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
    this.logHandler = options?.logHandler;
    this.healthChecker = getRouteHealthChecker({ logHandler: options?.logHandler });
    this.routeDecisionCache = new Map();
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
    this.logHandler?.({
      level,
      module: 'CdnRouter',
      message,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Build proxy URL for a stream
   */
  private buildProxyUrl(originalUrl: string): string {
    return `${this.config.proxyBaseUrl}?url=${encodeURIComponent(originalUrl)}`;
  }

  /**
   * Build R2 URL for a channel
   */
  private buildR2Url(channelId: string, filename: string = 'stream.m3u8'): string {
    return `${this.config.r2BaseUrl}/channels/${channelId}/${filename}`;
  }

  /**
   * Build Cloudflare Stream URL
   */
  private buildCfStreamUrl(channelId: string): string {
    return `${this.config.cfStreamBaseUrl}?channelId=${channelId}`;
  }

  /**
   * Check if content exists on R2
   */
  async checkR2Availability(channelId: string): Promise<boolean> {
    try {
      const url = this.buildR2Url(channelId);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if content exists on Cloudflare Stream
   */
  async checkCfStreamAvailability(channelId: string): Promise<boolean> {
    try {
      const url = this.buildCfStreamUrl(channelId);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      // CF Stream returns 200 for existing content
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Build all possible endpoints for a stream
   */
  async buildEndpoints(options: {
    originalUrl: string;
    channelId?: string;
    protocol?: ProtocolType;
    checkAvailability?: boolean;
  }): Promise<CdnEndpoint[]> {
    const { originalUrl, channelId, protocol, checkAvailability = false } = options;
    const endpoints: CdnEndpoint[] = [];
    const isHttpUrl = originalUrl.startsWith('http://');

    // 1. Proxy is always first priority (handles auth and HTTP->HTTPS)
    endpoints.push({
      type: 'proxy',
      url: this.buildProxyUrl(originalUrl),
      priority: 1,
      available: true, // Proxy is always available
      latency: this.healthChecker.getLatency('proxy'),
    });

    // 2. R2 (only if we have a channel ID and not an HTTP URL)
    if (channelId && !isHttpUrl) {
      const r2Available = checkAvailability 
        ? await this.checkR2Availability(channelId)
        : false;
      
      endpoints.push({
        type: 'r2',
        url: this.buildR2Url(channelId),
        priority: 2,
        available: r2Available,
        latency: this.healthChecker.getLatency('r2'),
      });
    }

    // 3. Cloudflare Stream (only if we have a channel ID)
    if (channelId) {
      const cfAvailable = checkAvailability 
        ? await this.checkCfStreamAvailability(channelId)
        : false;

      endpoints.push({
        type: 'cf-stream',
        url: this.buildCfStreamUrl(channelId),
        priority: 3,
        available: cfAvailable,
        latency: this.healthChecker.getLatency('cf-stream'),
      });
    }

    // 4. Origin (only for HTTPS URLs, not for HTTP due to mixed content)
    if (!isHttpUrl) {
      endpoints.push({
        type: 'origin',
        url: originalUrl,
        priority: 4,
        available: true,
      });
    }

    return endpoints;
  }

  /**
   * Route a stream to the best available CDN
   */
  async route(options: {
    originalUrl: string;
    channelId?: string;
    protocol?: ProtocolType;
    forceEndpoint?: CdnEndpointType;
    skipHealthCheck?: boolean;
  }): Promise<RouteDecision> {
    const { originalUrl, channelId, protocol, forceEndpoint, skipHealthCheck } = options;

    this.log('info', 'Routing stream', { originalUrl, channelId, protocol });

    // Check cache
    const cacheKey = `${originalUrl}:${channelId || ''}`;
    const cached = this.routeDecisionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheDecisionMs) {
      this.log('debug', 'Using cached route decision', { endpoint: cached.selectedEndpoint.type });
      return cached;
    }

    // Run health check if needed
    if (!skipHealthCheck && this.healthChecker.needsFullCheck()) {
      await this.healthChecker.checkAllEndpoints(originalUrl);
    }

    // Build endpoints
    const endpoints = await this.buildEndpoints({
      originalUrl,
      channelId,
      protocol,
      checkAvailability: true,
    });

    // If forced endpoint, use it
    if (forceEndpoint) {
      const forcedEndpoint = endpoints.find(e => e.type === forceEndpoint);
      if (forcedEndpoint) {
        const decision: RouteDecision = {
          selectedEndpoint: forcedEndpoint,
          allEndpoints: endpoints,
          reason: `Forced endpoint: ${forceEndpoint}`,
          timestamp: Date.now(),
          cacheable: false,
        };
        return decision;
      }
    }

    // Select best endpoint
    const selectedEndpoint = this.selectBestEndpoint(endpoints);

    const decision: RouteDecision = {
      selectedEndpoint,
      allEndpoints: endpoints,
      reason: this.getSelectionReason(selectedEndpoint, endpoints),
      timestamp: Date.now(),
      cacheable: true,
    };

    // Cache decision
    if (decision.cacheable) {
      this.routeDecisionCache.set(cacheKey, decision);
    }

    this.log('info', 'Route decision made', {
      selected: selectedEndpoint.type,
      url: selectedEndpoint.url,
      reason: decision.reason,
    });

    return decision;
  }

  /**
   * Select the best endpoint based on availability and health
   */
  private selectBestEndpoint(endpoints: CdnEndpoint[]): CdnEndpoint {
    // Filter to available and healthy endpoints
    const availableEndpoints = endpoints.filter(e => {
      if (!e.available) return false;
      if (e.type === 'origin') return true; // Origin doesn't need health check
      return this.healthChecker.isHealthy(e.type);
    });

    // If no healthy endpoints, fall back to proxy (always available)
    if (availableEndpoints.length === 0) {
      return endpoints.find(e => e.type === 'proxy') || endpoints[0];
    }

    // Sort by priority and latency
    availableEndpoints.sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by latency (if available)
      const aLatency = a.latency ?? Infinity;
      const bLatency = b.latency ?? Infinity;
      return aLatency - bLatency;
    });

    return availableEndpoints[0];
  }

  /**
   * Get human-readable selection reason
   */
  private getSelectionReason(selected: CdnEndpoint, all: CdnEndpoint[]): string {
    const healthStatus = this.healthChecker.isHealthy(selected.type);
    const availableCount = all.filter(e => e.available).length;

    if (selected.type === 'proxy') {
      if (selected.priority === 1) {
        return 'Proxy selected as primary route';
      }
      return 'Proxy selected as fallback (other endpoints unavailable)';
    }

    if (selected.type === 'r2') {
      return `R2 CDN selected (content available, latency: ${selected.latency || 'unknown'}ms)`;
    }

    if (selected.type === 'cf-stream') {
      return `Cloudflare Stream selected (transcoded content available)`;
    }

    if (selected.type === 'origin') {
      return 'Origin selected (direct HTTPS connection)';
    }

    return `Selected ${selected.type} (${availableCount} endpoints available)`;
  }

  /**
   * Create a failover path for a stream
   */
  async createFailoverPath(options: {
    originalUrl: string;
    channelId?: string;
    protocol?: ProtocolType;
  }): Promise<FailoverPath> {
    const endpoints = await this.buildEndpoints({
      ...options,
      checkAvailability: false, // Don't check for failover path
    });

    // Sort by priority
    endpoints.sort((a, b) => a.priority - b.priority);

    return {
      endpoints,
      currentIndex: 0,
      maxRetries: this.config.maxRetries,
      retryDelay: 1000,
    };
  }

  /**
   * Get next endpoint in failover path
   */
  getNextEndpoint(failoverPath: FailoverPath): CdnEndpoint | null {
    if (failoverPath.currentIndex >= failoverPath.endpoints.length) {
      return null;
    }
    const endpoint = failoverPath.endpoints[failoverPath.currentIndex];
    failoverPath.currentIndex++;
    return endpoint;
  }

  /**
   * Reset failover path to start
   */
  resetFailoverPath(failoverPath: FailoverPath): void {
    failoverPath.currentIndex = 0;
  }

  /**
   * Clear route decision cache
   */
  clearCache(): void {
    this.routeDecisionCache.clear();
    this.log('info', 'Route decision cache cleared');
  }

  /**
   * Get health checker instance
   */
  getHealthChecker(): RouteHealthChecker {
    return this.healthChecker;
  }
}

// Singleton instance
let routerInstance: CdnRouter | null = null;

export function getCdnRouter(options?: {
  config?: Partial<CdnRouterConfig>;
  logHandler?: LogHandler;
}): CdnRouter {
  if (!routerInstance) {
    routerInstance = new CdnRouter(options);
  }
  return routerInstance;
}

/**
 * Quick route function
 */
export async function routeStream(originalUrl: string, channelId?: string): Promise<RouteDecision> {
  return getCdnRouter().route({ originalUrl, channelId });
}

/**
 * Create failover path
 */
export async function createFailoverPath(originalUrl: string, channelId?: string): Promise<FailoverPath> {
  return getCdnRouter().createFailoverPath({ originalUrl, channelId });
}
