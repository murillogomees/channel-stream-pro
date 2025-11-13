export interface WebSocketMetrics {
  // Connection metrics
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  currentConnectionAttempt: number;
  
  // Timing metrics
  averageConnectionTime: number;
  lastConnectionTime: number;
  totalUptime: number;
  totalDowntime: number;
  
  // Reconnection metrics
  totalReconnections: number;
  reconnectionRate: number;
  averageTimeBetweenReconnections: number;
  longestUptimePeriod: number;
  
  // Latency metrics
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  latencyHistory: number[];
  
  // Event metrics
  totalEventsSent: number;
  totalEventsReceived: number;
  failedEvents: number;
  
  // Health status
  currentStatus: 'healthy' | 'degraded' | 'critical' | 'offline';
  fallbackModeActivations: number;
  lastHealthCheck: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  metrics: WebSocketMetrics;
}

class WebSocketMetricsService {
  private metrics: WebSocketMetrics;
  private connectionStartTime: number | null = null;
  private lastReconnectionTime: number | null = null;
  private uptimeStartTime: number | null = null;
  private downtimeStartTime: number | null = null;
  private snapshotHistory: MetricsSnapshot[] = [];
  private maxSnapshotHistory = 100;
  private latencyMeasurements: number[] = [];
  private maxLatencyHistory = 50;

  constructor() {
    this.metrics = this.getInitialMetrics();
  }

  private getInitialMetrics(): WebSocketMetrics {
    return {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      currentConnectionAttempt: 0,
      averageConnectionTime: 0,
      lastConnectionTime: 0,
      totalUptime: 0,
      totalDowntime: 0,
      totalReconnections: 0,
      reconnectionRate: 0,
      averageTimeBetweenReconnections: 0,
      longestUptimePeriod: 0,
      averageLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      latencyHistory: [],
      totalEventsSent: 0,
      totalEventsReceived: 0,
      failedEvents: 0,
      currentStatus: 'offline',
      fallbackModeActivations: 0,
      lastHealthCheck: Date.now(),
    };
  }

  // Connection tracking
  recordConnectionAttempt() {
    this.metrics.totalConnections++;
    this.metrics.currentConnectionAttempt++;
    this.connectionStartTime = Date.now();
    
    if (this.uptimeStartTime) {
      // We were connected, now trying to reconnect
      this.metrics.totalReconnections++;
      
      if (this.lastReconnectionTime) {
        const timeBetween = Date.now() - this.lastReconnectionTime;
        this.updateAverageBetweenReconnections(timeBetween);
      }
      this.lastReconnectionTime = Date.now();
    }
    
    this.updateHealthStatus();
  }

  recordConnectionSuccess() {
    this.metrics.successfulConnections++;
    this.metrics.currentConnectionAttempt = 0;
    
    if (this.connectionStartTime) {
      const connectionTime = Date.now() - this.connectionStartTime;
      this.metrics.lastConnectionTime = connectionTime;
      this.updateAverageConnectionTime(connectionTime);
      this.connectionStartTime = null;
    }
    
    // Start uptime tracking
    if (this.downtimeStartTime) {
      this.metrics.totalDowntime += Date.now() - this.downtimeStartTime;
      this.downtimeStartTime = null;
    }
    this.uptimeStartTime = Date.now();
    
    this.metrics.currentStatus = 'healthy';
    this.updateHealthStatus();
    this.createSnapshot();
  }

  recordConnectionFailure() {
    this.metrics.failedConnections++;
    this.connectionStartTime = null;
    
    // Start downtime tracking
    if (this.uptimeStartTime) {
      const uptimePeriod = Date.now() - this.uptimeStartTime;
      this.metrics.totalUptime += uptimePeriod;
      
      if (uptimePeriod > this.metrics.longestUptimePeriod) {
        this.metrics.longestUptimePeriod = uptimePeriod;
      }
      this.uptimeStartTime = null;
    }
    
    if (!this.downtimeStartTime) {
      this.downtimeStartTime = Date.now();
    }
    
    this.updateHealthStatus();
    this.createSnapshot();
  }

  recordFallbackMode() {
    this.metrics.fallbackModeActivations++;
    this.metrics.currentStatus = 'critical';
    this.createSnapshot();
  }

  // Latency tracking
  recordLatency(latencyMs: number) {
    this.latencyMeasurements.push(latencyMs);
    
    if (this.latencyMeasurements.length > this.maxLatencyHistory) {
      this.latencyMeasurements.shift();
    }
    
    this.metrics.latencyHistory = [...this.latencyMeasurements];
    this.metrics.averageLatency = this.calculateAverage(this.latencyMeasurements);
    this.metrics.minLatency = Math.min(...this.latencyMeasurements);
    this.metrics.maxLatency = Math.max(...this.latencyMeasurements);
  }

  // Event tracking
  recordEventSent() {
    this.metrics.totalEventsSent++;
  }

  recordEventReceived(latencyMs?: number) {
    this.metrics.totalEventsReceived++;
    if (latencyMs !== undefined) {
      this.recordLatency(latencyMs);
    }
  }

  recordEventFailed() {
    this.metrics.failedEvents++;
    this.updateHealthStatus();
  }

  // Health status calculation
  private updateHealthStatus() {
    const failureRate = this.metrics.failedConnections / Math.max(this.metrics.totalConnections, 1);
    const eventFailureRate = this.metrics.failedEvents / Math.max(this.metrics.totalEventsSent, 1);
    
    if (this.metrics.currentConnectionAttempt === 0) {
      if (failureRate < 0.1 && eventFailureRate < 0.05) {
        this.metrics.currentStatus = 'healthy';
      } else if (failureRate < 0.3 && eventFailureRate < 0.15) {
        this.metrics.currentStatus = 'degraded';
      } else {
        this.metrics.currentStatus = 'critical';
      }
    } else {
      if (this.metrics.currentConnectionAttempt >= 3) {
        this.metrics.currentStatus = 'critical';
      } else {
        this.metrics.currentStatus = 'degraded';
      }
    }
    
    this.metrics.lastHealthCheck = Date.now();
  }

  // Calculations
  private updateAverageConnectionTime(newTime: number) {
    const count = this.metrics.successfulConnections;
    const currentAvg = this.metrics.averageConnectionTime;
    this.metrics.averageConnectionTime = ((currentAvg * (count - 1)) + newTime) / count;
  }

  private updateAverageBetweenReconnections(newTime: number) {
    const count = this.metrics.totalReconnections;
    const currentAvg = this.metrics.averageTimeBetweenReconnections;
    this.metrics.averageTimeBetweenReconnections = ((currentAvg * (count - 1)) + newTime) / count;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // Current uptime/downtime
  getCurrentUptime(): number {
    if (!this.uptimeStartTime) return this.metrics.totalUptime;
    return this.metrics.totalUptime + (Date.now() - this.uptimeStartTime);
  }

  getCurrentDowntime(): number {
    if (!this.downtimeStartTime) return this.metrics.totalDowntime;
    return this.metrics.totalDowntime + (Date.now() - this.downtimeStartTime);
  }

  // Reconnection rate calculation
  calculateReconnectionRate(): number {
    const totalTime = this.getCurrentUptime() + this.getCurrentDowntime();
    if (totalTime === 0) return 0;
    
    // Reconnections per hour
    this.metrics.reconnectionRate = (this.metrics.totalReconnections / (totalTime / (1000 * 60 * 60)));
    return this.metrics.reconnectionRate;
  }

  // Snapshot management
  private createSnapshot() {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      metrics: { ...this.metrics },
    };
    
    this.snapshotHistory.push(snapshot);
    
    if (this.snapshotHistory.length > this.maxSnapshotHistory) {
      this.snapshotHistory.shift();
    }
  }

  getSnapshotHistory(): MetricsSnapshot[] {
    return [...this.snapshotHistory];
  }

  // Getters
  getMetrics(): WebSocketMetrics {
    return {
      ...this.metrics,
      totalUptime: this.getCurrentUptime(),
      totalDowntime: this.getCurrentDowntime(),
      reconnectionRate: this.calculateReconnectionRate(),
    };
  }

  // Reset
  reset() {
    this.metrics = this.getInitialMetrics();
    this.connectionStartTime = null;
    this.lastReconnectionTime = null;
    this.uptimeStartTime = null;
    this.downtimeStartTime = null;
    this.snapshotHistory = [];
    this.latencyMeasurements = [];
  }

  // Export for analysis
  exportMetrics(): string {
    const data = {
      metrics: this.getMetrics(),
      snapshots: this.snapshotHistory,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }
}

// Singleton instance
let metricsServiceInstance: WebSocketMetricsService | null = null;

export function getWebSocketMetricsService(): WebSocketMetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new WebSocketMetricsService();
  }
  return metricsServiceInstance;
}
