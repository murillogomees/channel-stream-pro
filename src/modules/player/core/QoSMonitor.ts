/**
 * ============================================================================
 * QoSMonitor - Quality of Service Monitoring
 * ============================================================================
 * 
 * Monitors and reports video playback quality metrics:
 * - Startup time (time to first frame)
 * - Rebuffering events and duration
 * - Bitrate changes
 * - Frame drops
 * - Network conditions
 * 
 * @version 1.0.0
 */

import { logger } from './Logger';

// =============================================================================
// TYPES
// =============================================================================

export interface QoSMetrics {
  // Timing
  sessionStartTime: number;
  playbackStartTime: number | null;
  startupTimeMs: number | null;
  
  // Rebuffering
  rebufferCount: number;
  totalRebufferDurationMs: number;
  currentRebufferStart: number | null;
  
  // Quality
  currentBitrate: number;
  averageBitrate: number;
  bitrateChanges: number;
  peakBitrate: number;
  
  // Frames
  droppedFrames: number;
  totalFrames: number;
  frameDropRate: number;
  
  // Buffer
  currentBufferLength: number;
  minBufferLength: number;
  maxBufferLength: number;
  
  // Network
  downloadThroughput: number; // bytes/second
  latency: number;
  
  // Errors
  errorCount: number;
  fatalErrorCount: number;
}

export interface QoSReport {
  sessionId: string;
  channelId: string;
  channelName: string;
  platform: string;
  durationSeconds: number;
  metrics: QoSMetrics;
  healthScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// =============================================================================
// QOS MONITOR CLASS
// =============================================================================

class QoSMonitor {
  private sessionId: string = '';
  private channelId: string = '';
  private channelName: string = '';
  private platform: string = 'unknown';
  
  private metrics: QoSMetrics = this.createInitialMetrics();
  private bitrateHistory: number[] = [];
  private isMonitoring: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  private createInitialMetrics(): QoSMetrics {
    return {
      sessionStartTime: 0,
      playbackStartTime: null,
      startupTimeMs: null,
      rebufferCount: 0,
      totalRebufferDurationMs: 0,
      currentRebufferStart: null,
      currentBitrate: 0,
      averageBitrate: 0,
      bitrateChanges: 0,
      peakBitrate: 0,
      droppedFrames: 0,
      totalFrames: 0,
      frameDropRate: 0,
      currentBufferLength: 0,
      minBufferLength: Infinity,
      maxBufferLength: 0,
      downloadThroughput: 0,
      latency: 0,
      errorCount: 0,
      fatalErrorCount: 0,
    };
  }

  startSession(
    channelId: string,
    channelName: string,
    platform: string = 'unknown'
  ): void {
    this.sessionId = `qos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.channelId = channelId;
    this.channelName = channelName;
    this.platform = platform;
    
    this.metrics = this.createInitialMetrics();
    this.metrics.sessionStartTime = Date.now();
    this.bitrateHistory = [];
    
    this.isMonitoring = true;
    
    logger.info('QoSMonitor', 'Session started', {
      sessionId: this.sessionId,
      channelId,
      channelName,
    });
  }

  attachVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.startMonitorLoop();
    
    // Listen for quality API if available
    video.addEventListener('playing', this.handlePlaying.bind(this));
    video.addEventListener('waiting', this.handleWaiting.bind(this));
  }

  detachVideoElement(): void {
    this.stopMonitorLoop();
    this.videoElement = null;
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  private handlePlaying(): void {
    // Record playback start
    if (!this.metrics.playbackStartTime) {
      this.metrics.playbackStartTime = Date.now();
      this.metrics.startupTimeMs = this.metrics.playbackStartTime - this.metrics.sessionStartTime;
      
      logger.info('QoSMonitor', 'Playback started', {
        startupTimeMs: this.metrics.startupTimeMs,
      });
    }
    
    // End rebuffering
    if (this.metrics.currentRebufferStart) {
      const rebufferDuration = Date.now() - this.metrics.currentRebufferStart;
      this.metrics.totalRebufferDurationMs += rebufferDuration;
      this.metrics.currentRebufferStart = null;
      
      logger.debug('QoSMonitor', 'Rebuffer ended', {
        durationMs: rebufferDuration,
        totalRebufferCount: this.metrics.rebufferCount,
      });
    }
  }

  private handleWaiting(): void {
    // Only count rebuffering after playback started
    if (this.metrics.playbackStartTime && !this.metrics.currentRebufferStart) {
      this.metrics.rebufferCount++;
      this.metrics.currentRebufferStart = Date.now();
      
      logger.debug('QoSMonitor', 'Rebuffer started', {
        rebufferCount: this.metrics.rebufferCount,
      });
    }
  }

  // ===========================================================================
  // MONITORING LOOP
  // ===========================================================================

  private startMonitorLoop(): void {
    this.stopMonitorLoop();
    
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, 1000); // Every second
  }

  private stopMonitorLoop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private collectMetrics(): void {
    if (!this.videoElement || !this.isMonitoring) return;
    
    // Buffer length
    const buffered = this.videoElement.buffered;
    const currentTime = this.videoElement.currentTime;
    let bufferLength = 0;
    
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
        bufferLength = buffered.end(i) - currentTime;
        break;
      }
    }
    
    this.metrics.currentBufferLength = bufferLength;
    this.metrics.minBufferLength = Math.min(this.metrics.minBufferLength, bufferLength);
    this.metrics.maxBufferLength = Math.max(this.metrics.maxBufferLength, bufferLength);
    
    // Frame statistics (if available)
    const videoPlaybackQuality = (this.videoElement as any).getVideoPlaybackQuality?.();
    if (videoPlaybackQuality) {
      this.metrics.droppedFrames = videoPlaybackQuality.droppedVideoFrames || 0;
      this.metrics.totalFrames = videoPlaybackQuality.totalVideoFrames || 0;
      
      if (this.metrics.totalFrames > 0) {
        this.metrics.frameDropRate = this.metrics.droppedFrames / this.metrics.totalFrames;
      }
    }
    
    // Calculate average bitrate
    if (this.bitrateHistory.length > 0) {
      this.metrics.averageBitrate = this.bitrateHistory.reduce((a, b) => a + b, 0) / this.bitrateHistory.length;
    }
  }

  // ===========================================================================
  // EXTERNAL UPDATES
  // ===========================================================================

  recordBitrateChange(bitrate: number): void {
    if (this.metrics.currentBitrate !== bitrate) {
      this.metrics.bitrateChanges++;
    }
    
    this.metrics.currentBitrate = bitrate;
    this.metrics.peakBitrate = Math.max(this.metrics.peakBitrate, bitrate);
    this.bitrateHistory.push(bitrate);
    
    // Keep history limited
    if (this.bitrateHistory.length > 300) {
      this.bitrateHistory.shift();
    }
    
    logger.debug('QoSMonitor', 'Bitrate change', {
      bitrate,
      changes: this.metrics.bitrateChanges,
    });
  }

  recordError(fatal: boolean = false): void {
    this.metrics.errorCount++;
    if (fatal) {
      this.metrics.fatalErrorCount++;
    }
  }

  recordThroughput(bytesPerSecond: number): void {
    this.metrics.downloadThroughput = bytesPerSecond;
  }

  recordLatency(latencyMs: number): void {
    this.metrics.latency = latencyMs;
  }

  // ===========================================================================
  // REPORTING
  // ===========================================================================

  getMetrics(): QoSMetrics {
    // Update current rebuffer duration if still rebuffering
    if (this.metrics.currentRebufferStart) {
      const currentRebuffer = Date.now() - this.metrics.currentRebufferStart;
      return {
        ...this.metrics,
        totalRebufferDurationMs: this.metrics.totalRebufferDurationMs + currentRebuffer,
      };
    }
    
    return { ...this.metrics };
  }

  calculateHealthScore(): number {
    const m = this.getMetrics();
    let score = 100;
    
    // Startup time penalty (target: < 3s)
    if (m.startupTimeMs) {
      if (m.startupTimeMs > 5000) score -= 20;
      else if (m.startupTimeMs > 3000) score -= 10;
    }
    
    // Rebuffer penalty
    score -= m.rebufferCount * 10;
    score -= Math.floor(m.totalRebufferDurationMs / 5000) * 5;
    
    // Frame drop penalty
    if (m.frameDropRate > 0.05) score -= 20;
    else if (m.frameDropRate > 0.01) score -= 10;
    
    // Error penalty
    score -= m.errorCount * 5;
    score -= m.fatalErrorCount * 20;
    
    // Buffer health bonus/penalty
    if (m.minBufferLength < 2) score -= 10;
    if (m.minBufferLength < 0.5) score -= 20;
    
    return Math.max(0, Math.min(100, score));
  }

  getGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.calculateHealthScore();
    
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  endSession(): QoSReport {
    this.isMonitoring = false;
    this.stopMonitorLoop();
    
    const durationSeconds = (Date.now() - this.metrics.sessionStartTime) / 1000;
    const healthScore = this.calculateHealthScore();
    const grade = this.getGrade();
    
    const report: QoSReport = {
      sessionId: this.sessionId,
      channelId: this.channelId,
      channelName: this.channelName,
      platform: this.platform,
      durationSeconds,
      metrics: this.getMetrics(),
      healthScore,
      grade,
    };
    
    logger.info('QoSMonitor', 'Session ended', {
      sessionId: this.sessionId,
      durationSeconds,
      healthScore,
      grade,
      rebufferCount: this.metrics.rebufferCount,
      startupTimeMs: this.metrics.startupTimeMs,
    });
    
    return report;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const qosMonitor = new QoSMonitor();
export default QoSMonitor;
