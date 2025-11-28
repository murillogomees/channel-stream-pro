/**
 * ============================================================================
 * TelemetryService - Telemetria e Métricas do Player
 * ============================================================================
 * 
 * Coleta e reporta:
 * - QoS (Quality of Service)
 * - Erros de playback
 * - Métricas de buffer
 * - Heartbeat
 * - Logs estruturados
 * 
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PlaybackMetrics {
  sessionId: string;
  channelId: string;
  channelName: string;
  startTime: number;
  playbackStartTime: number | null;
  startupTimeMs: number | null;
  stallCount: number;
  totalStallDurationMs: number;
  errorCount: number;
  retryCount: number;
  bufferHealth: number;
  currentBitrate: number | null;
  resolution: string | null;
}

export interface ErrorEvent {
  timestamp: number;
  type: 'network' | 'media' | 'decode' | 'unknown';
  code: string;
  message: string;
  fatal: boolean;
  recovered: boolean;
  context: Record<string, unknown>;
}

export interface BufferMetrics {
  timestamp: number;
  bufferedSeconds: number;
  targetBuffer: number;
  isBuffering: boolean;
  dropCount: number;
}

export interface HeartbeatData {
  sessionId: string;
  timestamp: number;
  state: string;
  playbackPosition: number;
  bufferHealth: number;
  isHealthy: boolean;
}

type TelemetryEventType = 'playback_start' | 'playback_end' | 'error' | 'stall' | 'quality_change' | 'heartbeat';

interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

// =============================================================================
// TELEMETRY SERVICE
// =============================================================================

class TelemetryService {
  private sessionId: string | null = null;
  private metrics: PlaybackMetrics | null = null;
  private errors: ErrorEvent[] = [];
  private bufferHistory: BufferMetrics[] = [];
  private eventQueue: TelemetryEvent[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;

  private readonly MAX_ERRORS = 100;
  private readonly MAX_BUFFER_HISTORY = 60;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  startSession(channelId: string, channelName: string): string {
    this.sessionId = this.generateSessionId();
    
    this.metrics = {
      sessionId: this.sessionId,
      channelId,
      channelName,
      startTime: Date.now(),
      playbackStartTime: null,
      startupTimeMs: null,
      stallCount: 0,
      totalStallDurationMs: 0,
      errorCount: 0,
      retryCount: 0,
      bufferHealth: 0,
      currentBitrate: null,
      resolution: null,
    };

    this.errors = [];
    this.bufferHistory = [];
    
    this.startHeartbeat();
    this.queueEvent('playback_start', { channelId, channelName });

    console.log(`[Telemetry] Session started: ${this.sessionId}`);
    return this.sessionId;
  }

  endSession(): PlaybackMetrics | null {
    if (!this.metrics) return null;

    this.stopHeartbeat();
    
    const finalMetrics = { ...this.metrics };
    this.queueEvent('playback_end', { metrics: finalMetrics });
    
    console.log(`[Telemetry] Session ended: ${this.sessionId}`, finalMetrics);
    
    // Flush events
    this.flushEvents();
    
    this.sessionId = null;
    this.metrics = null;
    
    return finalMetrics;
  }

  // ---------------------------------------------------------------------------
  // Metric Recording
  // ---------------------------------------------------------------------------

  recordPlaybackStart(): void {
    if (!this.metrics) return;

    this.metrics.playbackStartTime = Date.now();
    this.metrics.startupTimeMs = this.metrics.playbackStartTime - this.metrics.startTime;

    console.log(`[Telemetry] Playback started. Startup time: ${this.metrics.startupTimeMs}ms`);
  }

  recordStall(durationMs: number): void {
    if (!this.metrics) return;

    this.metrics.stallCount++;
    this.metrics.totalStallDurationMs += durationMs;

    this.queueEvent('stall', { 
      stallCount: this.metrics.stallCount, 
      durationMs,
      totalStallDurationMs: this.metrics.totalStallDurationMs,
    });

    console.log(`[Telemetry] Stall #${this.metrics.stallCount}: ${durationMs}ms`);
  }

  recordError(error: Omit<ErrorEvent, 'timestamp'>): void {
    if (!this.metrics) return;

    const errorEvent: ErrorEvent = {
      ...error,
      timestamp: Date.now(),
    };

    this.errors.push(errorEvent);
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors.shift();
    }

    this.metrics.errorCount++;

    this.queueEvent('error', errorEvent as unknown as Record<string, unknown>);

    console.error(`[Telemetry] Error:`, errorEvent);
  }

  recordRetry(): void {
    if (!this.metrics) return;
    this.metrics.retryCount++;
    console.log(`[Telemetry] Retry #${this.metrics.retryCount}`);
  }

  recordBuffer(bufferedSeconds: number, targetBuffer: number, isBuffering: boolean): void {
    if (!this.metrics) return;

    const bufferMetric: BufferMetrics = {
      timestamp: Date.now(),
      bufferedSeconds,
      targetBuffer,
      isBuffering,
      dropCount: 0,
    };

    this.bufferHistory.push(bufferMetric);
    if (this.bufferHistory.length > this.MAX_BUFFER_HISTORY) {
      this.bufferHistory.shift();
    }

    this.metrics.bufferHealth = Math.min(1, bufferedSeconds / targetBuffer);
  }

  recordQualityChange(bitrate: number, resolution: string): void {
    if (!this.metrics) return;

    this.metrics.currentBitrate = bitrate;
    this.metrics.resolution = resolution;

    this.queueEvent('quality_change', { bitrate, resolution });

    console.log(`[Telemetry] Quality change: ${resolution} @ ${bitrate}bps`);
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (!this.metrics || !this.sessionId) return;

      const heartbeat: HeartbeatData = {
        sessionId: this.sessionId,
        timestamp: Date.now(),
        state: 'playing', // Should come from state machine
        playbackPosition: 0, // Should come from video element
        bufferHealth: this.metrics.bufferHealth,
        isHealthy: this.metrics.stallCount < 3 && this.metrics.errorCount < 5,
      };

      this.queueEvent('heartbeat', heartbeat as unknown as Record<string, unknown>);
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Event Queue
  // ---------------------------------------------------------------------------

  private queueEvent(type: TelemetryEventType, data: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      type,
      timestamp: Date.now(),
      data: {
        sessionId: this.sessionId,
        ...data,
      },
    });

    // Auto-flush when queue gets large
    if (this.eventQueue.length >= 10) {
      this.flushEvents();
    }
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    // In production, this would send to an analytics endpoint
    // For now, just log
    console.log(`[Telemetry] Flushing ${this.eventQueue.length} events`);
    
    // TODO: Send to analytics endpoint
    // await fetch('/api/telemetry', { 
    //   method: 'POST', 
    //   body: JSON.stringify(this.eventQueue) 
    // });

    this.eventQueue = [];
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getMetrics(): PlaybackMetrics | null {
    return this.metrics ? { ...this.metrics } : null;
  }

  getErrors(): ErrorEvent[] {
    return [...this.errors];
  }

  getBufferHistory(): BufferMetrics[] {
    return [...this.bufferHistory];
  }

  getQoSSummary() {
    if (!this.metrics) return null;

    const sessionDuration = Date.now() - this.metrics.startTime;
    const playbackDuration = this.metrics.playbackStartTime 
      ? Date.now() - this.metrics.playbackStartTime 
      : 0;

    return {
      sessionId: this.sessionId,
      channelId: this.metrics.channelId,
      channelName: this.metrics.channelName,
      sessionDurationMs: sessionDuration,
      playbackDurationMs: playbackDuration,
      startupTimeMs: this.metrics.startupTimeMs,
      stallCount: this.metrics.stallCount,
      stallRatio: playbackDuration > 0 
        ? this.metrics.totalStallDurationMs / playbackDuration 
        : 0,
      errorCount: this.metrics.errorCount,
      retryCount: this.metrics.retryCount,
      avgBufferHealth: this.calculateAvgBufferHealth(),
      isHealthy: this.isSessionHealthy(),
    };
  }

  private calculateAvgBufferHealth(): number {
    if (this.bufferHistory.length === 0) return 0;
    const sum = this.bufferHistory.reduce((acc, b) => acc + (b.bufferedSeconds / b.targetBuffer), 0);
    return Math.min(1, sum / this.bufferHistory.length);
  }

  private isSessionHealthy(): boolean {
    if (!this.metrics) return false;
    
    return (
      this.metrics.stallCount < 3 &&
      this.metrics.errorCount < 5 &&
      (this.metrics.startupTimeMs === null || this.metrics.startupTimeMs < 5000)
    );
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const telemetryService = new TelemetryService();
export default TelemetryService;
