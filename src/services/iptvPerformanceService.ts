/**
 * IPTV Performance Optimization Service
 * Frontend service for performance monitoring and optimization
 */

import { supabase } from '@/integrations/supabase/client';

// Types
export interface NetworkConditions {
  bandwidth: number;
  latency: number;
  jitter: number;
  packetLoss: number;
}

export interface OptimizationResult {
  recommendedCDN: string;
  recommendedQuality: string;
  bufferSize: number;
  preloadSegments: number;
  adaptiveSettings: {
    minBitrate: number;
    maxBitrate: number;
    startLevel: number;
  };
}

export interface QualityLevel {
  id: string;
  bitrate: number;
  width: number;
  height: number;
  codec: string;
}

export interface AdaptationDecision {
  targetQuality: QualityLevel;
  switchReason: string;
  confidence: number;
  bufferRecommendation: number;
}

export interface PerformanceMetrics {
  latency: number;
  bandwidth: number;
  bufferHealth: number;
  errorRate: number;
  timestamp?: string;
}

export interface PrefetchTask {
  id: string;
  channelId: number;
  url: string;
  priority: number;
  type: 'manifest' | 'segment' | 'logo';
}

class IPTVPerformanceService {
  private bandwidthHistory: number[] = [];
  private latencyHistory: number[] = [];
  private lastMeasurement: number = 0;

  // Measure current network conditions
  async measureNetwork(testUrl?: string): Promise<NetworkConditions> {
    const url = testUrl || 'https://cdn.iptvlink.com.br/probe.bin';
    const samples: { bandwidth: number; latency: number }[] = [];

    // Take 3 samples
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch(url + `?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
        });
        
        const data = await response.arrayBuffer();
        const elapsed = performance.now() - start;
        
        const bandwidth = (data.byteLength * 8) / (elapsed / 1000) / 1000; // kbps
        samples.push({ bandwidth, latency: elapsed });
      } catch {
        samples.push({ bandwidth: 1000, latency: 500 }); // Fallback values
      }
    }

    // Calculate averages
    const avgBandwidth = samples.reduce((s, x) => s + x.bandwidth, 0) / samples.length;
    const avgLatency = samples.reduce((s, x) => s + x.latency, 0) / samples.length;
    
    // Calculate jitter (variance in latency)
    const jitter = Math.sqrt(
      samples.reduce((s, x) => s + Math.pow(x.latency - avgLatency, 2), 0) / samples.length
    );

    // Update history
    this.bandwidthHistory.push(avgBandwidth);
    this.latencyHistory.push(avgLatency);
    if (this.bandwidthHistory.length > 10) this.bandwidthHistory.shift();
    if (this.latencyHistory.length > 10) this.latencyHistory.shift();

    this.lastMeasurement = Date.now();

    return {
      bandwidth: Math.round(avgBandwidth),
      latency: Math.round(avgLatency),
      jitter: Math.round(jitter),
      packetLoss: 0, // Would need actual packet loss detection
    };
  }

  // Get optimization recommendations
  async getOptimization(
    channelId?: number,
    deviceType: string = 'desktop'
  ): Promise<OptimizationResult> {
    const network = await this.measureNetwork();

    const { data } = await supabase.functions.invoke('iptv-performance', {
      body: {
        action: 'optimize',
        bandwidth: network.bandwidth,
        latency: network.latency,
        deviceType,
        channelId,
      },
    });

    return data?.optimization || {
      recommendedCDN: 'https://cdn.iptvlink.com.br',
      recommendedQuality: '720p',
      bufferSize: 30,
      preloadSegments: 3,
      adaptiveSettings: {
        minBitrate: 300,
        maxBitrate: 2500,
        startLevel: 2,
      },
    };
  }

  // Adaptive bitrate control
  async getAdaptation(
    currentQuality: string,
    bufferLevel: number,
    segmentDuration: number = 4
  ): Promise<{
    decision: AdaptationDecision;
    canSwitch: boolean;
    throughputEstimate: number;
  }> {
    const network = await this.measureNetwork();
    const previousEstimate = this.bandwidthHistory.length > 0
      ? this.bandwidthHistory.reduce((s, x) => s + x, 0) / this.bandwidthHistory.length
      : 0;

    const { data } = await supabase.functions.invoke('iptv-abr-controller', {
      body: {
        action: 'adapt',
        currentQuality,
        bufferLevel,
        network,
        segmentDuration,
        previousEstimate,
      },
    });

    return {
      decision: data?.decision || {
        targetQuality: { id: '720p', bitrate: 2500, width: 1280, height: 720, codec: 'h264' },
        switchReason: 'stable',
        confidence: 80,
        bufferRecommendation: 30,
      },
      canSwitch: data?.canSwitch ?? true,
      throughputEstimate: data?.throughputEstimate ?? network.bandwidth,
    };
  }

  // Get quality ladder
  async getQualityLadder(): Promise<QualityLevel[]> {
    const { data } = await supabase.functions.invoke('iptv-abr-controller', {
      body: { action: 'ladder' },
    });

    return data?.ladder || [];
  }

  // Record performance metrics
  async recordMetrics(
    channelId: number,
    metrics: PerformanceMetrics,
    sessionId?: string
  ): Promise<{ recommendations: string[] }> {
    const { data } = await supabase.functions.invoke('iptv-performance', {
      body: {
        action: 'metrics',
        channelId,
        metrics: {
          ...metrics,
          timestamp: new Date().toISOString(),
        },
        sessionId,
      },
    });

    return { recommendations: data?.recommendations || [] };
  }

  // Health check endpoints
  async checkEndpointHealth(urls: string[]): Promise<{
    results: Array<{ url: string; healthy: boolean; latency: number }>;
    summary: { healthy: number; unhealthy: number; avgLatency: number };
  }> {
    const { data } = await supabase.functions.invoke('iptv-performance', {
      body: {
        action: 'health-check',
        urls,
      },
    });

    return data || { results: [], summary: { healthy: 0, unhealthy: 0, avgLatency: 0 } };
  }

  // Get prefetch plan
  async getPrefetchPlan(
    strategy: 'aggressive' | 'conservative' | 'adaptive' = 'adaptive',
    currentChannelId?: number
  ): Promise<{ tasks: PrefetchTask[]; patterns: unknown[] }> {
    const { data } = await supabase.functions.invoke('iptv-prefetch', {
      body: {
        action: 'plan',
        strategy,
        currentChannelId,
      },
    });

    return { tasks: data?.tasks || [], patterns: data?.patterns || [] };
  }

  // Execute prefetch tasks
  async executePrefetch(tasks: PrefetchTask[]): Promise<{
    success: number;
    failed: number;
    avgLatency: number;
  }> {
    const { data } = await supabase.functions.invoke('iptv-prefetch', {
      body: {
        action: 'execute',
        tasks,
      },
    });

    return {
      success: data?.summary?.success || 0,
      failed: data?.summary?.failed || 0,
      avgLatency: data?.summary?.avgLatency || 0,
    };
  }

  // Get segments to prefetch
  async getSegmentsToPrefetch(
    manifestUrl: string,
    currentSegment: number,
    segmentsAhead: number = 3
  ): Promise<string[]> {
    const { data } = await supabase.functions.invoke('iptv-prefetch', {
      body: {
        action: 'segments',
        manifestUrl,
        currentSegment,
        segmentsAhead,
      },
    });

    return data?.prefetchUrls || [];
  }

  // Prewarm cache
  async prewarmCache(channelIds: number[], ttl?: number): Promise<{
    warmed: number;
    failed: number;
  }> {
    const { data } = await supabase.functions.invoke('iptv-performance', {
      body: {
        action: 'prewarm',
        channelIds,
        ttl,
      },
    });

    return {
      warmed: data?.summary?.warmed || 0,
      failed: data?.summary?.failed || 0,
    };
  }

  // Get performance analytics
  async getAnalytics(
    timeRange: '1h' | '24h' | '7d' = '24h',
    channelId?: number
  ): Promise<{
    avgLatency: number;
    avgBandwidth: number;
    avgBufferHealth: number;
    totalErrors: number;
    sampleCount: number;
  }> {
    const { data } = await supabase.functions.invoke('iptv-performance', {
      body: {
        action: 'analytics',
        timeRange,
        channelId,
      },
    });

    return data?.analytics || {
      avgLatency: 0,
      avgBandwidth: 0,
      avgBufferHealth: 0,
      totalErrors: 0,
      sampleCount: 0,
    };
  }

  // Load balance channels across CDNs
  async loadBalance(channelIds: number[]): Promise<{
    distribution: Record<string, number[]>;
    cdnNodes: Array<{ id: string; url: string; region: string }>;
  }> {
    const { data } = await supabase.functions.invoke('iptv-performance', {
      body: {
        action: 'load-balance',
        channelIds,
      },
    });

    return data || { distribution: {}, cdnNodes: [] };
  }

  // Simulate ABR behavior
  async simulateABR(
    duration: number,
    scenarios: Array<{ time: number; bandwidth: number; latency: number }>
  ): Promise<{
    timeline: Array<{ time: number; quality: string; buffer: number }>;
    stats: { totalSwitches: number; rebufferEvents: number; avgBitrate: number };
  }> {
    const { data } = await supabase.functions.invoke('iptv-abr-controller', {
      body: {
        action: 'simulate',
        duration,
        scenarios,
      },
    });

    return {
      timeline: data?.timeline || [],
      stats: data?.stats || { totalSwitches: 0, rebufferEvents: 0, avgBitrate: 0 },
    };
  }

  // Get estimated bandwidth from history
  getEstimatedBandwidth(): number {
    if (this.bandwidthHistory.length === 0) return 5000;
    return Math.round(
      this.bandwidthHistory.reduce((s, x) => s + x, 0) / this.bandwidthHistory.length
    );
  }

  // Get estimated latency from history
  getEstimatedLatency(): number {
    if (this.latencyHistory.length === 0) return 50;
    return Math.round(
      this.latencyHistory.reduce((s, x) => s + x, 0) / this.latencyHistory.length
    );
  }

  // Check if measurement is stale
  isMeasurementStale(maxAgeMs: number = 30000): boolean {
    return Date.now() - this.lastMeasurement > maxAgeMs;
  }
}

export const iptvPerformanceService = new IPTVPerformanceService();
