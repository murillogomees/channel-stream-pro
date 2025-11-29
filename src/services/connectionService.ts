/**
 * ============================================================================
 * Connection Service - Network Quality Detection
 * ============================================================================
 * 
 * Detecta qualidade da conexão e sugere bitrate inicial apropriado.
 * Usa Network Information API quando disponível.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ConnectionType = 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'ethernet' | 'unknown';
export type ConnectionQuality = 'poor' | 'fair' | 'good' | 'excellent';

export interface ConnectionInfo {
  type: ConnectionType;
  quality: ConnectionQuality;
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
  suggestedMaxBitrate: number; // bps
  suggestedStartLevel: 'lowest' | 'medium' | 'highest' | 'auto';
}

export interface ConnectionChangeCallback {
  (info: ConnectionInfo): void;
}

// =============================================================================
// NETWORK API TYPE
// =============================================================================

interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  onchange?: EventListener;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

// =============================================================================
// BITRATE RECOMMENDATIONS
// =============================================================================

const BITRATE_RECOMMENDATIONS: Record<ConnectionQuality, { max: number; startLevel: ConnectionInfo['suggestedStartLevel'] }> = {
  poor: { max: 500_000, startLevel: 'lowest' },      // 500 Kbps - 360p
  fair: { max: 1_500_000, startLevel: 'lowest' },    // 1.5 Mbps - 480p
  good: { max: 4_000_000, startLevel: 'medium' },    // 4 Mbps - 720p
  excellent: { max: 10_000_000, startLevel: 'auto' }, // 10 Mbps - 1080p+
};

// =============================================================================
// CONNECTION SERVICE CLASS
// =============================================================================

class ConnectionService {
  private connection: NetworkInformation | null = null;
  private listeners: Set<ConnectionChangeCallback> = new Set();
  private lastInfo: ConnectionInfo | null = null;
  private measurementHistory: { downlink: number; rtt: number; timestamp: number }[] = [];
  private isMonitoring = false;

  constructor() {
    this.initializeConnection();
  }

  /**
   * Initialize network connection listener
   */
  private initializeConnection(): void {
    this.connection = 
      navigator.connection || 
      navigator.mozConnection || 
      navigator.webkitConnection || 
      null;

    if (this.connection) {
      this.connection.addEventListener('change', this.handleConnectionChange);
      console.log('[Connection] Network Information API available');
    } else {
      console.log('[Connection] Network Information API not available, using fallback');
    }
  }

  /**
   * Handle connection change event
   */
  private handleConnectionChange = (): void => {
    const info = this.getConnectionInfo();
    this.lastInfo = info;
    this.notifyListeners(info);
  };

  /**
   * Map effective type to connection type
   */
  private mapEffectiveType(effectiveType?: string): ConnectionType {
    switch (effectiveType) {
      case 'slow-2g': return 'slow-2g';
      case '2g': return '2g';
      case '3g': return '3g';
      case '4g': return '4g';
      default: return 'unknown';
    }
  }

  /**
   * Map connection type string to our type
   */
  private mapConnectionType(type?: string): ConnectionType {
    switch (type) {
      case 'wifi': return 'wifi';
      case 'ethernet': return 'ethernet';
      case 'cellular': return this.mapEffectiveType(this.connection?.effectiveType);
      default: return this.mapEffectiveType(this.connection?.effectiveType);
    }
  }

  /**
   * Determine connection quality from metrics
   */
  private determineQuality(downlink: number, rtt: number): ConnectionQuality {
    // Quality based on downlink (Mbps) and RTT (ms)
    if (downlink >= 10 && rtt < 50) return 'excellent';
    if (downlink >= 4 && rtt < 100) return 'good';
    if (downlink >= 1.5 && rtt < 200) return 'fair';
    return 'poor';
  }

  /**
   * Get current connection info
   */
  getConnectionInfo(): ConnectionInfo {
    const downlink = this.connection?.downlink ?? this.estimateDownlink();
    const rtt = this.connection?.rtt ?? this.estimateRTT();
    const saveData = this.connection?.saveData ?? false;
    
    const type = this.mapConnectionType(this.connection?.type);
    const quality = saveData ? 'poor' : this.determineQuality(downlink, rtt);
    const recommendation = BITRATE_RECOMMENDATIONS[quality];

    return {
      type,
      quality,
      downlink,
      rtt,
      saveData,
      suggestedMaxBitrate: recommendation.max,
      suggestedStartLevel: recommendation.startLevel,
    };
  }

  /**
   * Estimate downlink when API not available
   */
  private estimateDownlink(): number {
    if (this.measurementHistory.length > 0) {
      const recent = this.measurementHistory.slice(-5);
      return recent.reduce((sum, m) => sum + m.downlink, 0) / recent.length;
    }
    return 5; // Default 5 Mbps assumption
  }

  /**
   * Estimate RTT when API not available
   */
  private estimateRTT(): number {
    if (this.measurementHistory.length > 0) {
      const recent = this.measurementHistory.slice(-5);
      return recent.reduce((sum, m) => sum + m.rtt, 0) / recent.length;
    }
    return 100; // Default 100ms assumption
  }

  /**
   * Measure actual connection speed by fetching a small resource
   */
  async measureConnection(): Promise<ConnectionInfo> {
    const startTime = performance.now();
    
    try {
      // Use a small image or API endpoint for measurement
      const testUrl = `https://www.google.com/favicon.ico?t=${Date.now()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const rtt = Math.round(endTime - startTime);

      // Estimate downlink based on RTT (rough approximation)
      const estimatedDownlink = rtt < 50 ? 10 : rtt < 100 ? 5 : rtt < 200 ? 2 : 1;

      this.measurementHistory.push({
        downlink: estimatedDownlink,
        rtt,
        timestamp: Date.now(),
      });

      // Keep only last 10 measurements
      if (this.measurementHistory.length > 10) {
        this.measurementHistory.shift();
      }

      console.log('[Connection] Measured RTT:', rtt, 'ms, estimated downlink:', estimatedDownlink, 'Mbps');
    } catch (err) {
      console.debug('[Connection] Measurement failed:', err);
    }

    return this.getConnectionInfo();
  }

  /**
   * Record actual download speed from stream loading
   */
  recordDownloadSpeed(bytesLoaded: number, durationMs: number): void {
    if (durationMs <= 0) return;

    const bitsPerSecond = (bytesLoaded * 8) / (durationMs / 1000);
    const mbps = bitsPerSecond / 1_000_000;

    this.measurementHistory.push({
      downlink: mbps,
      rtt: this.connection?.rtt ?? this.estimateRTT(),
      timestamp: Date.now(),
    });

    // Keep only last 10 measurements
    if (this.measurementHistory.length > 10) {
      this.measurementHistory.shift();
    }

    console.log('[Connection] Recorded speed:', mbps.toFixed(2), 'Mbps');
  }

  /**
   * Subscribe to connection changes
   */
  subscribe(callback: ConnectionChangeCallback): () => void {
    this.listeners.add(callback);
    
    // Immediately call with current info
    const currentInfo = this.getConnectionInfo();
    callback(currentInfo);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(info: ConnectionInfo): void {
    this.listeners.forEach(callback => {
      try {
        callback(info);
      } catch (err) {
        console.error('[Connection] Listener error:', err);
      }
    });
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    const monitor = async () => {
      if (!this.isMonitoring) return;
      await this.measureConnection();
      setTimeout(monitor, intervalMs);
    };

    monitor();
    console.log('[Connection] Started monitoring every', intervalMs, 'ms');
  }

  /**
   * Stop periodic monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('[Connection] Stopped monitoring');
  }

  /**
   * Get HLS.js config optimized for current connection
   */
  getHlsConfig(): Partial<{
    maxBufferLength: number;
    maxMaxBufferLength: number;
    startLevel: number;
    autoStartLoad: boolean;
    capLevelToPlayerSize: boolean;
  }> {
    const info = this.getConnectionInfo();

    switch (info.quality) {
      case 'poor':
        return {
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          startLevel: 0, // Lowest
          autoStartLoad: true,
          capLevelToPlayerSize: true,
        };
      case 'fair':
        return {
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          startLevel: 0, // Start low, let ABR adapt
          autoStartLoad: true,
          capLevelToPlayerSize: true,
        };
      case 'good':
        return {
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1, // Auto
          autoStartLoad: true,
          capLevelToPlayerSize: false,
        };
      case 'excellent':
      default:
        return {
          maxBufferLength: 30,
          maxMaxBufferLength: 120,
          startLevel: -1, // Auto
          autoStartLoad: true,
          capLevelToPlayerSize: false,
        };
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.listeners.clear();
    if (this.connection) {
      this.connection.removeEventListener('change', this.handleConnectionChange);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const connectionService = new ConnectionService();
export default connectionService;
