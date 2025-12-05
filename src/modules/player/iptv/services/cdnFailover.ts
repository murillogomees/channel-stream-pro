/**
 * CDN Failover Service
 * Handles automatic CDN switching on stream failures
 */

import type { CdnEndpoint, IptvPlayerEvent } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const R2_CDN_URL = 'https://pub-iptvlink.r2.dev';

export interface FailoverConfig {
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  preferredRegion?: string;
}

export interface FailoverState {
  currentIndex: number;
  failedEndpoints: Set<string>;
  retryCount: number;
  lastSwitch: number;
}

export class CdnFailoverService {
  private config: FailoverConfig;
  private state: FailoverState;
  private endpoints: CdnEndpoint[] = [];
  private onEvent?: (evt: IptvPlayerEvent, data?: any) => void;

  constructor(config?: Partial<FailoverConfig>) {
    this.config = {
      maxRetries: 3,
      retryDelay: 2000,
      healthCheckInterval: 30000,
      ...config,
    };
    
    this.state = {
      currentIndex: 0,
      failedEndpoints: new Set(),
      retryCount: 0,
      lastSwitch: 0,
    };
  }

  /**
   * Set event callback
   */
  setEventCallback(callback: (evt: IptvPlayerEvent, data?: any) => void) {
    this.onEvent = callback;
  }

  /**
   * Initialize with CDN endpoints
   */
  initialize(endpoints: CdnEndpoint[]) {
    // Sort by priority (lower = higher priority)
    this.endpoints = [...endpoints].sort((a, b) => a.priority - b.priority);
    
    // Apply region preference if set
    if (this.config.preferredRegion) {
      this.endpoints.sort((a, b) => {
        if (a.region === this.config.preferredRegion) return -1;
        if (b.region === this.config.preferredRegion) return 1;
        return 0;
      });
    }
    
    this.state = {
      currentIndex: 0,
      failedEndpoints: new Set(),
      retryCount: 0,
      lastSwitch: Date.now(),
    };

    console.log('[CDN Failover] Initialized with', this.endpoints.length, 'endpoints');
  }

  /**
   * Build CDN list from channel URL
   * 
   * PRIORIDADE PARA HTTP:
   * 1. Stream Proxy (obrigatório para Mixed Content)
   * 2. Origin (fallback)
   * 
   * PRIORIDADE PARA HTTPS/VOD com R2:
   * 1. R2 CDN
   * 2. CF Stream
   * 3. Origin
   */
  buildEndpointsFromUrl(
    originalUrl: string, 
    channelId?: string,
    options?: { hasR2?: boolean; hasCfStream?: boolean; r2Url?: string; cfStreamUrl?: string }
  ): CdnEndpoint[] {
    const endpoints: CdnEndpoint[] = [];
    const isHttpUrl = originalUrl.startsWith('http://');
    const isSecurePage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    // CASO 1: HTTP URL em página HTTPS - PROXY É OBRIGATÓRIO
    if (isHttpUrl && isSecurePage) {
      // Proxy primeiro (única forma de funcionar)
      endpoints.push({
        url: `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(originalUrl)}`,
        priority: 1,
        type: 'proxy',
      });
      
      // Origin como fallback (para debug/dev)
      endpoints.push({
        url: originalUrl,
        priority: 2,
        type: 'origin',
      });
      
      return endpoints;
    }
    
    // CASO 2: Conteúdo com R2/CF-Stream disponível
    if (options?.hasR2 && options.r2Url) {
      endpoints.push({
        url: options.r2Url,
        priority: 1,
        type: 'r2',
        region: 'global',
      });
    }
    
    if (options?.hasCfStream && options.cfStreamUrl) {
      endpoints.push({
        url: options.cfStreamUrl,
        priority: options?.hasR2 ? 2 : 1,
        type: 'cf-stream',
      });
    }
    
    // CASO 3: HTTPS direto ou fallback
    endpoints.push({
      url: originalUrl,
      priority: endpoints.length + 1,
      type: 'origin',
    });

    return endpoints;
  }

  /**
   * Get current active endpoint
   */
  getCurrentEndpoint(): CdnEndpoint | null {
    if (this.endpoints.length === 0) return null;
    return this.endpoints[this.state.currentIndex] || null;
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string | null {
    return this.getCurrentEndpoint()?.url || null;
  }

  /**
   * Report error and attempt failover
   */
  async handleError(error: Error): Promise<string | null> {
    const current = this.getCurrentEndpoint();
    if (!current) return null;

    console.log('[CDN Failover] Error on endpoint:', current.type, error.message);
    
    // Mark current endpoint as failed
    this.state.failedEndpoints.add(current.url);
    this.state.retryCount++;

    // Check if we should retry same endpoint
    if (this.state.retryCount <= this.config.maxRetries) {
      console.log('[CDN Failover] Retrying same endpoint, attempt', this.state.retryCount);
      await this.delay(this.config.retryDelay * this.state.retryCount);
      return current.url;
    }

    // Switch to next endpoint
    return this.switchToNext();
  }

  /**
   * Switch to next available endpoint
   */
  switchToNext(): string | null {
    const availableEndpoints = this.endpoints.filter(
      ep => !this.state.failedEndpoints.has(ep.url)
    );

    if (availableEndpoints.length === 0) {
      console.log('[CDN Failover] All endpoints exhausted');
      // Reset failed endpoints and try again from start
      this.state.failedEndpoints.clear();
      this.state.currentIndex = 0;
      this.state.retryCount = 0;
      return this.endpoints[0]?.url || null;
    }

    // Find next available endpoint
    for (let i = this.state.currentIndex + 1; i < this.endpoints.length; i++) {
      if (!this.state.failedEndpoints.has(this.endpoints[i].url)) {
        this.state.currentIndex = i;
        this.state.retryCount = 0;
        this.state.lastSwitch = Date.now();
        
        const newEndpoint = this.endpoints[i];
        console.log('[CDN Failover] Switched to:', newEndpoint.type, newEndpoint.url.substring(0, 50));
        
        this.onEvent?.('cdnswitch', {
          from: this.endpoints[this.state.currentIndex - 1]?.type,
          to: newEndpoint.type,
          url: newEndpoint.url,
        });
        
        return newEndpoint.url;
      }
    }

    // Wrap around to start
    for (let i = 0; i < this.state.currentIndex; i++) {
      if (!this.state.failedEndpoints.has(this.endpoints[i].url)) {
        this.state.currentIndex = i;
        this.state.retryCount = 0;
        this.state.lastSwitch = Date.now();
        return this.endpoints[i].url;
      }
    }

    return null;
  }

  /**
   * Health check current endpoint
   */
  async healthCheck(): Promise<boolean> {
    const current = this.getCurrentEndpoint();
    if (!current) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(current.url, {
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
   * Reset failover state
   */
  reset() {
    this.state = {
      currentIndex: 0,
      failedEndpoints: new Set(),
      retryCount: 0,
      lastSwitch: Date.now(),
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      currentEndpoint: this.getCurrentEndpoint(),
      failedCount: this.state.failedEndpoints.size,
      retryCount: this.state.retryCount,
      totalEndpoints: this.endpoints.length,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const cdnFailover = new CdnFailoverService();
