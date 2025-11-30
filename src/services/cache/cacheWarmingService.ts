/**
 * ============================================================================
 * Cache Warming Service
 * ============================================================================
 * 
 * Proactively warms cache based on predictions.
 * Manages background preloading without impacting current playback.
 */

import { predictiveCacheEngine, PredictionScore } from './predictiveCacheEngine';
import { streamCacheService } from '../streamCacheService';

// =============================================================================
// TYPES
// =============================================================================

export interface WarmingStats {
  warmedManifests: number;
  warmedSegments: number;
  failedWarms: number;
  lastWarmTime: number;
  avgWarmDuration: number;
  queueSize: number;
}

export interface WarmingConfig {
  enabled: boolean;
  maxConcurrent: number;
  warmingInterval: number; // ms
  manifestTimeout: number; // ms
  segmentTimeout: number; // ms
  maxSegmentsPerManifest: number;
  lowBandwidthMode: boolean;
}

interface WarmingTask {
  channelId: string;
  url: string;
  priority: 'high' | 'medium' | 'low';
  addedAt: number;
  retries: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: WarmingConfig = {
  enabled: true,
  maxConcurrent: 2,
  warmingInterval: 10000, // 10 seconds
  manifestTimeout: 5000,
  segmentTimeout: 8000,
  maxSegmentsPerManifest: 2,
  lowBandwidthMode: false,
};

// =============================================================================
// CACHE WARMING SERVICE
// =============================================================================

class CacheWarmingService {
  private config: WarmingConfig = DEFAULT_CONFIG;
  private warmingQueue: WarmingTask[] = [];
  private activeWarms: Set<string> = new Set();
  private stats: WarmingStats = {
    warmedManifests: 0,
    warmedSegments: 0,
    failedWarms: 0,
    lastWarmTime: 0,
    avgWarmDuration: 0,
    queueSize: 0,
  };
  private warmingTimer: NodeJS.Timeout | null = null;
  private isWarming: boolean = false;
  private abortControllers: Map<string, AbortController> = new Map();

  /**
   * Initialize warming service
   */
  async initialize(config: Partial<WarmingConfig> = {}): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize stream cache
    await streamCacheService.init();
    
    // Start warming loop
    if (this.config.enabled) {
      this.startWarmingLoop();
    }

    console.log('[CacheWarming] Initialized with config:', this.config);
  }

  /**
   * Add predictions to warming queue
   */
  queuePredictions(
    predictions: PredictionScore[],
    channelList: Array<{ id: string; stream_url: string }>
  ): void {
    if (!this.config.enabled) return;

    predictions.forEach(prediction => {
      const channel = channelList.find(c => c.id === prediction.channelId);
      if (!channel) return;

      // Skip if already queued or warming
      if (
        this.warmingQueue.some(t => t.channelId === prediction.channelId) ||
        this.activeWarms.has(prediction.channelId)
      ) {
        return;
      }

      const priority = prediction.score >= 70 ? 'high' 
        : prediction.score >= 40 ? 'medium' 
        : 'low';

      this.warmingQueue.push({
        channelId: prediction.channelId,
        url: channel.stream_url,
        priority,
        addedAt: Date.now(),
        retries: 0,
      });
    });

    // Sort by priority
    this.warmingQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Trim queue
    if (this.warmingQueue.length > 20) {
      this.warmingQueue = this.warmingQueue.slice(0, 20);
    }

    this.stats.queueSize = this.warmingQueue.length;
    console.log('[CacheWarming] Queue updated, size:', this.warmingQueue.length);
  }

  /**
   * Warm a specific URL immediately (high priority)
   */
  async warmNow(url: string, channelId: string): Promise<boolean> {
    if (this.activeWarms.has(channelId)) return false;

    return this.warmManifest({ 
      channelId, 
      url, 
      priority: 'high',
      addedAt: Date.now(),
      retries: 0,
    });
  }

  /**
   * Cancel warming for a channel
   */
  cancelWarming(channelId: string): void {
    // Remove from queue
    this.warmingQueue = this.warmingQueue.filter(t => t.channelId !== channelId);
    
    // Abort active warming
    const controller = this.abortControllers.get(channelId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(channelId);
    }
    
    this.activeWarms.delete(channelId);
  }

  /**
   * Pause warming (e.g., when bandwidth is needed for playback)
   */
  pause(): void {
    this.isWarming = false;
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
      this.warmingTimer = null;
    }
    console.log('[CacheWarming] Paused');
  }

  /**
   * Resume warming
   */
  resume(): void {
    if (!this.warmingTimer && this.config.enabled) {
      this.startWarmingLoop();
      console.log('[CacheWarming] Resumed');
    }
  }

  /**
   * Set low bandwidth mode (reduces warming aggressiveness)
   */
  setLowBandwidthMode(enabled: boolean): void {
    this.config.lowBandwidthMode = enabled;
    
    if (enabled) {
      this.config.maxConcurrent = 1;
      this.config.maxSegmentsPerManifest = 1;
      this.config.warmingInterval = 20000;
    } else {
      this.config.maxConcurrent = 2;
      this.config.maxSegmentsPerManifest = 2;
      this.config.warmingInterval = 10000;
    }

    console.log('[CacheWarming] Low bandwidth mode:', enabled);
  }

  /**
   * Get warming statistics
   */
  getStats(): WarmingStats {
    return { 
      ...this.stats,
      queueSize: this.warmingQueue.length,
    };
  }

  /**
   * Clear all warmed cache
   */
  async clearCache(): Promise<void> {
    await streamCacheService.clear();
    this.warmingQueue = [];
    this.stats = {
      warmedManifests: 0,
      warmedSegments: 0,
      failedWarms: 0,
      lastWarmTime: 0,
      avgWarmDuration: 0,
      queueSize: 0,
    };
    console.log('[CacheWarming] Cache cleared');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.pause();
    this.abortControllers.forEach(c => c.abort());
    this.abortControllers.clear();
    this.activeWarms.clear();
    this.warmingQueue = [];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private startWarmingLoop(): void {
    this.warmingTimer = setInterval(() => {
      this.processQueue();
    }, this.config.warmingInterval);

    // Process immediately
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isWarming || this.warmingQueue.length === 0) return;
    if (this.activeWarms.size >= this.config.maxConcurrent) return;

    this.isWarming = true;

    try {
      // Get tasks to process
      const availableSlots = this.config.maxConcurrent - this.activeWarms.size;
      const tasksToProcess = this.warmingQueue.splice(0, availableSlots);

      // Process in parallel
      await Promise.allSettled(
        tasksToProcess.map(task => this.warmManifest(task))
      );
    } finally {
      this.isWarming = false;
    }
  }

  private async warmManifest(task: WarmingTask): Promise<boolean> {
    const startTime = Date.now();
    this.activeWarms.add(task.channelId);

    const controller = new AbortController();
    this.abortControllers.set(task.channelId, controller);

    try {
      // Fetch manifest
      const response = await fetch(task.url, {
        signal: controller.signal,
        headers: { 'Accept': '*/*' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const manifest = await response.text();

      // Cache manifest
      await streamCacheService.cacheManifest(task.url, manifest);
      this.stats.warmedManifests++;

      // Optionally prefetch initial segments
      if (!this.config.lowBandwidthMode) {
        await streamCacheService.prefetchSegments(
          task.url,
          manifest,
          this.config.maxSegmentsPerManifest
        );
        this.stats.warmedSegments += this.config.maxSegmentsPerManifest;
      }

      // Update stats
      const duration = Date.now() - startTime;
      this.updateAvgDuration(duration);
      this.stats.lastWarmTime = Date.now();

      console.log('[CacheWarming] Warmed:', task.channelId, 'in', duration, 'ms');
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[CacheWarming] Failed to warm:', task.channelId, err);
        this.stats.failedWarms++;

        // Retry logic
        if (task.retries < 2) {
          task.retries++;
          this.warmingQueue.push(task);
        }
      }
      return false;
    } finally {
      this.activeWarms.delete(task.channelId);
      this.abortControllers.delete(task.channelId);
    }
  }

  private updateAvgDuration(duration: number): void {
    const total = this.stats.warmedManifests + this.stats.failedWarms;
    if (total === 0) {
      this.stats.avgWarmDuration = duration;
    } else {
      this.stats.avgWarmDuration = 
        (this.stats.avgWarmDuration * (total - 1) + duration) / total;
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const cacheWarmingService = new CacheWarmingService();
export default cacheWarmingService;
