/**
 * Player Metrics Service
 * 
 * Collects and calculates player performance metrics:
 * - Startup time (p50/p95)
 * - Rebuffering events
 * - Quality metrics
 * - Error rates
 */

import { supabase } from '@/lib/supabase';

export interface PlayerMetric {
  timestamp: number;
  event: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface MetricsReport {
  period_start: string;
  period_end: string;
  sample_size: number;
  startup: {
    p50_ms: number;
    p95_ms: number;
    avg_ms: number;
    min_ms: number;
    max_ms: number;
  };
  buffering: {
    total_events: number;
    avg_duration_ms: number;
    p95_duration_ms: number;
    affected_sessions_pct: number;
  };
  quality: {
    avg_bitrate_kbps: number;
    quality_switches: number;
    dropped_frames_pct: number;
  };
  errors: {
    total: number;
    by_type: Record<string, number>;
    error_rate_pct: number;
  };
  engagement: {
    avg_watch_time_s: number;
    completion_rate_pct: number;
  };
}

class PlayerMetricsService {
  private metrics: PlayerMetric[] = [];
  private sessionId: string | null = null;
  private sessionStart: number = 0;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  
  // Metric buffers for percentile calculation
  private startupTimes: number[] = [];
  private bufferingDurations: number[] = [];
  private bitrates: number[] = [];
  
  /**
   * Start a new metrics collection session
   */
  startSession(contentId: string, contentType: 'live' | 'vod'): string {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStart = Date.now();
    this.metrics = [];
    
    this.recordMetric('session_start', 1, {
      content_id: contentId,
      content_type: contentType,
      user_agent: navigator.userAgent,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    });
    
    // Auto-flush every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30000);
    
    return this.sessionId;
  }
  
  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.sessionId) return;
    
    const watchTime = (Date.now() - this.sessionStart) / 1000;
    this.recordMetric('session_end', watchTime);
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    await this.flush();
    this.sessionId = null;
  }
  
  /**
   * Record a metric
   */
  recordMetric(event: string, value: number, metadata?: Record<string, unknown>): void {
    const metric: PlayerMetric = {
      timestamp: Date.now(),
      event,
      value,
      metadata,
    };
    
    this.metrics.push(metric);
    
    // Update buffers for percentile calculation
    switch (event) {
      case 'startup_time':
        this.startupTimes.push(value);
        break;
      case 'buffering_duration':
        this.bufferingDurations.push(value);
        break;
      case 'bitrate':
        this.bitrates.push(value);
        break;
    }
    
    // Flush if buffer is large
    if (this.metrics.length >= 50) {
      this.flush();
    }
  }
  
  /**
   * Record startup time
   */
  recordStartup(timeMs: number): void {
    this.recordMetric('startup_time', timeMs, {
      threshold_met: timeMs < 3000,
    });
  }
  
  /**
   * Record buffering event
   */
  recordBuffering(durationMs: number): void {
    this.recordMetric('buffering_duration', durationMs, {
      severe: durationMs > 3000,
    });
  }
  
  /**
   * Record quality change
   */
  recordQualityChange(fromBitrate: number, toBitrate: number, reason: string): void {
    this.recordMetric('quality_switch', toBitrate - fromBitrate, {
      from_bitrate: fromBitrate,
      to_bitrate: toBitrate,
      reason,
    });
    this.bitrates.push(toBitrate);
  }
  
  /**
   * Record playback error
   */
  recordError(errorType: string, errorMessage: string): void {
    this.recordMetric('error', 1, {
      error_type: errorType,
      error_message: errorMessage,
    });
  }
  
  /**
   * Flush metrics to server
   */
  async flush(): Promise<void> {
    if (this.metrics.length === 0) return;
    
    const metricsToSend = [...this.metrics];
    this.metrics = [];
    
    try {
      const { error } = await supabase.functions.invoke('player-events', {
        body: {
          session_id: this.sessionId,
          metrics: metricsToSend,
          summary: {
            startup_p50: this.calculatePercentile(this.startupTimes, 0.5),
            startup_p95: this.calculatePercentile(this.startupTimes, 0.95),
            buffering_p95: this.calculatePercentile(this.bufferingDurations, 0.95),
            avg_bitrate: this.calculateAverage(this.bitrates),
          },
        },
      });
      
      if (error) {
        console.warn('[PlayerMetrics] Flush error:', error);
      }
    } catch (err) {
      console.warn('[PlayerMetrics] Flush failed:', err);
    }
  }
  
  /**
   * Calculate percentile from array
   */
  private calculatePercentile(arr: number[], percentile: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[index] || 0;
  }
  
  /**
   * Calculate average
   */
  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): {
    startup_p50: number;
    startup_p95: number;
    buffering_count: number;
    avg_bitrate: number;
    error_count: number;
  } {
    return {
      startup_p50: this.calculatePercentile(this.startupTimes, 0.5),
      startup_p95: this.calculatePercentile(this.startupTimes, 0.95),
      buffering_count: this.bufferingDurations.length,
      avg_bitrate: this.calculateAverage(this.bitrates),
      error_count: this.metrics.filter(m => m.event === 'error').length,
    };
  }
  
  /**
   * Fetch historical metrics report
   */
  async fetchMetricsReport(periodHours: number = 24): Promise<MetricsReport | null> {
    try {
      const { data, error } = await supabase.functions.invoke('qa-validation', {
        body: { action: 'metrics' },
      });
      
      if (error) throw error;
      
      // Parse the QA validation response
      const metricsResult = data?.results?.find((r: { test: string }) => r.test === 'player_metrics');
      
      if (!metricsResult) return null;
      
      return {
        period_start: new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        sample_size: metricsResult.details?.sample_size || 0,
        startup: {
          p50_ms: metricsResult.details?.startup_p50_ms || 0,
          p95_ms: metricsResult.details?.startup_p95_ms || 0,
          avg_ms: 0,
          min_ms: 0,
          max_ms: 0,
        },
        buffering: {
          total_events: 0,
          avg_duration_ms: 0,
          p95_duration_ms: 0,
          affected_sessions_pct: 0,
        },
        quality: {
          avg_bitrate_kbps: 0,
          quality_switches: 0,
          dropped_frames_pct: 0,
        },
        errors: {
          total: 0,
          by_type: {},
          error_rate_pct: 0,
        },
        engagement: {
          avg_watch_time_s: 0,
          completion_rate_pct: 0,
        },
      };
    } catch (err) {
      console.error('[PlayerMetrics] Report fetch failed:', err);
      return null;
    }
  }
}

export const playerMetricsService = new PlayerMetricsService();
export default playerMetricsService;
